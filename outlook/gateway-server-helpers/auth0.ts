import type { ServerConfigurer } from '@interopio/gateway-server/web/server';
import { IOGateway } from '@interopio/gateway';
import { randomUUID } from 'node:crypto';
// import {getSuccessHtml} from './auth0-success.html.ts';
import { readFileSync } from 'node:fs';

export type Auth0FlowData = {
    access_token?: string | null,
    id_token?: string | null,
    token_type?: string | null,
    expires_in?: number | null,
    state?: string | null,
}

const successPage = readFileSync('./auth0-success.html').toString();

// ---------------------------------------------------------------------------
// Auth0 integration — Implicit Flow with response_mode=form_post
//
// GET  /login/auth0                  → redirects to Auth0 Universal Login
// POST /api/webhooks/auth0/callback  → Auth0 POSTs tokens back here
// ---------------------------------------------------------------------------
export const auth0 = async (
    config: {
        logger: IOGateway.Logging.Logger,
        domain: string,
        clientId: string,
        scopes?: string,
        audience?: string,
        auth0FlowData: Auth0FlowData
    },
    {
        handle
    }: ServerConfigurer
) => {
    const { logger, domain, clientId } = config;
    const scopes = config.scopes ?? 'openid profile email';
    const loginCallbackPath = '/api/webhooks/auth0/callback';
    const loginUrlPath = '/login/auth0';

    logger.info(`auth0 login endpoint registered on [${loginUrlPath}]`);
    logger.info(`auth0 callback endpoint registered on [${loginCallbackPath}]`);

    handle(
        // ---------------------------------------------------------------
        // GET /login/auth0 — redirect to Auth0 Universal Login
        // ---------------------------------------------------------------
        {
            request: { method: 'GET', path: loginUrlPath },
            options: { authorize: { access: 'permitted' } },
            handler: async ({ request, response }) => {
                
                const nonce = randomUUID();
                const state = randomUUID();
                const redirectUri = `${request.protocol}://${request.host}${loginCallbackPath}`;
                logger.info('initiating Auth0 implicit login flow', { redirectUri });

                const authorizeUrl = `https://${domain}/authorize?` + new URLSearchParams({
                    response_type: 'id_token token',
                    response_mode: 'form_post',
                    client_id: clientId,
                    redirect_uri: redirectUri,
                    scope: scopes,
                    state,
                    nonce,
                    audience: config.audience ?? `io.bridge`,

                }).toString();

                logger.info(`redirecting to Auth0: ${authorizeUrl}`);
                response.setRawStatusCode(302);
                response.headers.set('Location', authorizeUrl);
                await response.end();
            }
        },
        // ---------------------------------------------------------------
        // POST /api/webhooks/auth0/callback — Auth0 posts tokens here
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

                const idToken = formData.get('id_token');
                let username = 'unknown';
                if (idToken && typeof idToken === 'string') {
                    const payload = JSON.parse(Buffer.from(idToken.split('.')[1], 'base64').toString());
                    username = payload.nickname || payload.name || payload.email || 'unknown';
                }

                // set config.auth0FlowData with the received tokens and data
                config.auth0FlowData.access_token = formData.get('access_token');
                config.auth0FlowData.id_token = idToken;
                config.auth0FlowData.token_type = formData.get('token_type');
                config.auth0FlowData.expires_in = formData.get('expires_in') ? Number(formData.get('expires_in')) : undefined;
                config.auth0FlowData.state = formData.get('state');

                response.setRawStatusCode(200);
                response.headers.set('Content-Type', 'text/html');

                
                await response.body(new TextEncoder().encode(successPage.replace('${username}', username)));
                await response.end();
            }
        }
    );
}
