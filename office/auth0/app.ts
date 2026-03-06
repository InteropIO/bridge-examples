import type { ServerConfigurer } from "@interopio/gateway-server/web/server";
import type { Logger } from "@interopio/gateway/logging/api";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export type AuthInfo = {
    user: string
    username?: string,
    token?: string | null
    headers?: Record<string, string>
}

const successPage = readFileSync(resolve(import.meta.dirname, './success.html')).toString();

// PKCE helpers
function generateCodeVerifier(): string {
    return randomBytes(32).toString('base64url');
}

function generateCodeChallenge(verifier: string): string {
    return createHash('sha256').update(verifier).digest('base64url');
}

// ---------------------------------------------------------------------------
// Auth0 integration — Authorization Code Flow with PKCE
//
// GET  /login/auth0              → redirects to Auth0 Universal Login
// POST /login/oauth2/code/auth0  → Auth0 POSTs authorization code back here;
//                                  we exchange it for tokens (including a
//                                  refresh token when offline_access is granted)
// ---------------------------------------------------------------------------
export const app = async (
    config: {
        logger: Logger,
        issuerUrl: string,
        clientId: string,
        scope?: string,
        audience?: string,
        authInfoResolver: (data: AuthInfo) => void,
    },
    {
        handle
    }: ServerConfigurer
) => {
    const { logger, issuerUrl, clientId } = config;
    const scopes = config.scope ?? "openid email offline_access";
    const loginCallbackPath = "/login/oauth2/code/auth0";
    const loginUrlPath = "/login/auth0";

    // PKCE state — single-user server, one login at a time
    let pendingCodeVerifier: string | undefined;
    let pendingRedirectUri: string | undefined;

    // Mutable reference to the resolved auth info so we can update the token
    let currentAuthInfo: AuthInfo | undefined;

    // -----------------------------------------------------------------------
    // Token refresh
    // -----------------------------------------------------------------------
    const refreshAccessToken = async (refreshToken: string) => {
        try {
            const response = await fetch(`${issuerUrl}/oauth/token`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    grant_type: 'refresh_token',
                    client_id: clientId,
                    refresh_token: refreshToken,
                }),
            });

            if (!response.ok) {
                logger.warn(`token refresh failed: ${response.status} ${response.statusText}`);
                // Retry in 30 seconds
                setTimeout(() => refreshAccessToken(refreshToken), 30_000);
                return;
            }

            const tokens = await response.json() as {
                access_token: string;
                refresh_token?: string;
                expires_in: number;
            };

            if (currentAuthInfo) {
                currentAuthInfo.token = tokens.access_token;
                logger.info(`access token refreshed for "${currentAuthInfo.user}"`);
            }

            // Auth0 may rotate the refresh token — use the new one if provided
            scheduleRefresh(tokens.refresh_token ?? refreshToken, tokens.expires_in);
        } catch (err) {
            logger.warn(`token refresh error: ${err}`);
            setTimeout(() => refreshAccessToken(refreshToken), 30_000);
        }
    };

    const scheduleRefresh = (refreshToken: string, expiresIn: number) => {
        // Refresh 60 seconds before expiry, minimum 10 seconds
        const refreshMs = Math.max((expiresIn - 60) * 1000, 10_000);
        logger.info(`scheduling token refresh in ${Math.round(refreshMs / 1000)}s`);
        setTimeout(() => refreshAccessToken(refreshToken), refreshMs);
    };

    logger.info(`auth0 login endpoint registered on [${loginUrlPath}]`);
    logger.info(`auth0 callback endpoint registered on [${loginCallbackPath}]`);

    handle(
        // ---------------------------------------------------------------
        // GET /login/auth0 — redirect to Auth0 with PKCE challenge
        // ---------------------------------------------------------------
        {
            request: { method: 'GET', path: loginUrlPath },
            options: { authorize: { access: "permitted" } },
            handler: async ({ request, response }) => {

                const nonce = randomUUID();
                const state = randomUUID();
                const codeVerifier = generateCodeVerifier();
                const codeChallenge = generateCodeChallenge(codeVerifier);
                const redirectUri = `${request.protocol}://${request.host}${loginCallbackPath}`;

                // Store PKCE verifier for the callback
                pendingCodeVerifier = codeVerifier;
                pendingRedirectUri = redirectUri;

                logger.info(`initiating Auth0 authorization code + PKCE flow → ${redirectUri}`);

                const authorizeUrl = `${issuerUrl}/authorize?` + new URLSearchParams({
                    response_type: 'code',
                    response_mode: 'form_post',
                    client_id: clientId,
                    redirect_uri: redirectUri,
                    scope: scopes,
                    state,
                    nonce,
                    audience: config.audience ?? `io.bridge`,
                    code_challenge: codeChallenge,
                    code_challenge_method: 'S256',
                }).toString();

                logger.info(`redirecting to Auth0: ${authorizeUrl}`);
                response.setRawStatusCode(302);
                response.headers.set('Location', authorizeUrl);
                await response.end();
            }
        },
        // ---------------------------------------------------------------
        // POST /login/oauth2/code/auth0 — Auth0 posts authorization code;
        //       exchange it for access, id & refresh tokens
        // ---------------------------------------------------------------
        {
            request: { method: 'POST', path: loginCallbackPath },
            options: { authorize: { access: 'permitted' } },
            handler: async ({ request, response }) => {
                const formData = await request.formData();

                const error = formData.get('error');
                const errorDescription = formData.get('error_description');

                if (error) {
                    logger.warn(`auth0 error: ${error} — ${errorDescription}`);
                    response.setRawStatusCode(400);
                    await response.body(new TextEncoder().encode(
                        `Auth0 login failed: ${error} — ${errorDescription ?? 'unknown error'}`
                    ));
                    await response.end();
                    return;
                }

                const code = formData.get('code');
                if (!code || !pendingCodeVerifier || !pendingRedirectUri) {
                    logger.warn('missing authorization code or PKCE verifier');
                    response.setRawStatusCode(400);
                    await response.body(new TextEncoder().encode(
                        'Missing authorization code or PKCE verifier. Please retry login.'
                    ));
                    await response.end();
                    return;
                }

                // Exchange the authorization code for tokens
                const codeVerifier = pendingCodeVerifier;
                const redirectUri = pendingRedirectUri;
                pendingCodeVerifier = undefined;
                pendingRedirectUri = undefined;

                const tokenResponse = await fetch(`${issuerUrl}/oauth/token`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        grant_type: 'authorization_code',
                        client_id: clientId,
                        code_verifier: codeVerifier,
                        code,
                        redirect_uri: redirectUri,
                    }),
                });

                if (!tokenResponse.ok) {
                    const errorBody = await tokenResponse.text();
                    logger.warn(`token exchange failed: ${tokenResponse.status} — ${errorBody}`);
                    response.setRawStatusCode(400);
                    await response.body(new TextEncoder().encode(
                        `Token exchange failed: ${errorBody}`
                    ));
                    await response.end();
                    return;
                }

                const tokens = await tokenResponse.json() as {
                    access_token: string;
                    id_token?: string;
                    refresh_token?: string;
                    expires_in: number;
                };

                let user = 'dev-user';
                let username;
                if (tokens.id_token) {
                    const payload = JSON.parse(Buffer.from(tokens.id_token.split('.')[1], 'base64').toString());
                    user = payload.email;
                    username = payload.name;
                }
                username ??= user;

                // Resolve the auth info promise (consumed by gateway mesh config)
                const authInfo: AuthInfo = {
                    token: tokens.access_token,
                    user,
                    username
                };
                currentAuthInfo = authInfo;
                config.authInfoResolver(authInfo);

                // Schedule automatic token refresh if we received a refresh token
                if (tokens.refresh_token && tokens.expires_in) {
                    scheduleRefresh(tokens.refresh_token, tokens.expires_in);
                } else {
                    logger.warn(
                        'no refresh token received — token will not auto-renew. ' +
                        'Ensure the Auth0 API has "Allow Offline Access" enabled and the ' +
                        '"offline_access" scope is requested.'
                    );
                }

                response.setRawStatusCode(200);
                response.headers.set('Content-Type', 'text/html');


                await response.body(new TextEncoder().encode(successPage.replace('${username}', `${username} (${user})`)));
                await response.end();
            }
        }
    );
}
