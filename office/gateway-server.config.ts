import { defineConfig } from "@interopio/gateway-server/config";

import { tmpdir } from "node:os";
import opener from "opener";

import * as IOGatewayLogging from "@interopio/gateway/logging/core";
import type { ServerConfigurer } from "@interopio/gateway-server/web/server";

import type { AuthInfo } from "./auth0/app.ts";
import { app } from "./auth0/app.ts";

try {
    process.loadEnvFile();
}
catch (e) {
    if (e.code === "ENOENT") {
        // fine, no .env file
    }
    else {
        throw e;
    }
}

const BRIDGE_URL = process.env["IO_GATEWAY_BRIDGE_URL"] ?? process.env["VITE_IO_BRIDGE_URL"] ?? "https://gw-bridge-examples.interop.io";

let authInfoResolver: (data: AuthInfo) => void;
const authInfoPromise: Promise<AuthInfo> = new Promise((resolve) => {
    authInfoResolver = resolve;
});

const host = "127.0.0.1"; // accessible only locally for security reasons
const port = 8385; // same port as io.Connect Desktop's default gateway port
const IO_CD_ENV = "DEMO";
const IO_CD_REGION = "INTEROP.IO";

const logger = IOGatewayLogging.getLogger("gateway.bridge");

// ---------------------------------------------------------------------------
// Probe io.Bridge to determine whether authentication is required.
//
// POST <bridge_url>/api/nodes  with body []
//   2xx                                → no auth required
//   401 + WWW-Authenticate: Bearer     → auth required
//   other response / network error     → unreachable / unknown
//
// Note: If the bridge uses custom/self-signed certificates, start the gateway
// server with `node --use-system-ca` so fetch trusts the system CA store.
// ---------------------------------------------------------------------------
async function probeBridgeAuth(
    bridgeUrl: string,
    token?: string,
): Promise<"none" | "required" | "unreachable"> {
    const headers: Record<string, string> = {
        "Content-Type": "application/json",
    };
    if (token) {
        headers["Authorization"] = `Bearer ${token}`;
    }

    try {
        const response = await fetch(new URL("/api/nodes", bridgeUrl), {
            method: "POST",
            headers,
            body: "[]",
            signal: AbortSignal.timeout(5_000),
        });
        if (response.ok) return "none";
        if (
            response.status === 401 &&
            response.headers.get("WWW-Authenticate")?.startsWith("Bearer")
        ) {
            return "required";
        }
        return "unreachable";
    } catch {
        return "unreachable";
    }
}

export default defineConfig({
    host,
    port,
    cors: false,
    auth: {
        type: "none",
    },

    gateway: {
        authentication: {
            basic: {
                usernameResolver: async (_login) => {
                    const { user } = await authInfoPromise;
                    return user;
                },
            },
        },
        contexts: {
            visibility: [
                { context: /___channel___.+/, restrictions: "cluster" },
                { context: /T42\..*/, restrictions: "local" },
                { context: /___workspace___.+/, restrictions: "local" },
                { context: /___window-hibernation___.+/, restrictions: "local" },
                { context: /___instance___.+/, restrictions: "local" },
                { context: /___window___.+/, restrictions: "local" },
                { restrictions: "cluster" },
            ],
        },

        methods: {
            visibility: [
                {
                    identity: { application: "Outlook" },
                    restrictions: "cluster",
                },
                {
                    identity: { application: "IOXLAddin" },
                    restrictions: "cluster",
                },
                { method: /T42\..*/, restrictions: "local" },
                { restrictions: "local" },
            ],
        },
        peers: {
            visibility: [
                { domain: "context", restrictions: "cluster" },
                { domain: "interop", restrictions: "cluster" },
                { domain: "bus", restrictions: "local" },
            ],
        },
        mesh: {
            enabled: true,
            auth: {
                // auth0 config and data
            },
            cluster: {
                endpoint: BRIDGE_URL,
                opts: {
                    getHeaders: async () => {
                        const headers: Record<string, string> = {};
                        const authInfo = await authInfoPromise;
                        if (authInfo.token) {
                            headers["Authorization"] = `Bearer ${authInfo.token}`;
                        }
                        return headers;
                    },
                },
            },
        },
    },

    management: {
        server: {
            path: (() => {
                if (process.platform === "win32") {
                    return `\\\\.\\pipe\\gateway-server-${IO_CD_ENV}-${IO_CD_REGION}-${process.env.USERNAME}`;
                } else {
                    return `${tmpdir()}/gateway-server-${IO_CD_ENV}-${IO_CD_REGION}-${process.env.USER}.sock`;
                }
            })(),
        },
        commands: {
            shutdown: {
                enabled: false,
            },
        },
    },

    // -----------------------------------------------------------------------
    // The `app` callback runs once the HTTP server is ready, so any routes we
    // register here (e.g. the Auth0 callback) are live before we open the
    // browser — solving the chicken-and-egg problem.
    // -----------------------------------------------------------------------
    app: async (configurer: ServerConfigurer) => {
        // 1. Probe the bridge to decide if authentication is needed.
        const authResult = await probeBridgeAuth(BRIDGE_URL);
        logger.info(
            `io.Bridge auth probe: ${authResult} (${BRIDGE_URL})`,
        );

        // 2a. Bridge responded 2xx — no authentication required.
        if (authResult === "none") {
            const user =
                process.env.USERNAME || process.env.USER || "dev-user";
            logger.info(
                `Bridge does not require authentication — using local user "${user}"`,
            );
            authInfoResolver({ user });
            return;
        }

        // 2b. Auth required (or bridge unreachable — fall back to auth if
        //     configured, so mesh can connect once bridge becomes available).
        const issuerUrl = process.env["IO_GATEWAY_AUTH_ISSUERURI"] ?? process.env["IO_BRIDGE_SERVER_AUTH_OAUTH2_JWT_ISSUERURI"] ?? `https://${process.env["VITE_AUTH0_DOMAIN"]}`;
        const clientId = process.env["IO_GATEWAY_AUTH_CLIENT_ID"] ?? process.env["VITE_AUTH0_CLIENT_ID"];
        const audience = process.env["IO_GATEWAY_AUTH_AUDIENCE"] ?? process.env["IO_BRIDGE_SERVER_AUTH_OAUTH2_JWT_AUDIENCE"] ?? process.env["VITE_AUTH0_AUDIENCE"];

        if (!issuerUrl || !clientId || !audience) {
            if (authResult === "required") {
                throw new Error(
                    "io.Bridge requires authentication but Auth0 is not configured. " +
                    "Set IO_BRIDGE_SERVER_AUTH_OAUTH2_JWT_ISSUERURI, VITE_AUTH0_CLIENT_ID, " +
                    "and IO_BRIDGE_SERVER_AUTH_OAUTH2_JWT_AUDIENCE in your .env file.",
                );
            }

            // Bridge unreachable + no Auth0 config — proceed without a token;
            // the mesh connection will retry on its own once the bridge is up.
            const user =
                process.env.USERNAME || process.env.USER || "dev-user";
            logger.warn(
                `Bridge unreachable and Auth0 not configured — proceeding as "${user}" without token`,
            );
            authInfoResolver({ user });
            return;
        }

        // 3. Register Auth0 login & callback routes (must happen before we
        //    open the browser so the callback endpoint is ready).
        await app(
            {
                logger: IOGatewayLogging.getLogger("gateway.bridge.auth0"),
                authInfoResolver,
                issuerUrl,
                clientId,
                audience,
                scope: process.env.IO_GATEWAY_AUTH0_SCOPE,
            },
            configurer,
        );

        // 4. Open the Auth0 login page in the default browser.
        logger.info("Opening Auth0 login in system browser…");
        opener(`http://localhost:${port}/login/auth0`);

        // 5. (Optional) Once the token arrives, verify it works against the
        //    bridge so we get an early, clear log entry.
        authInfoPromise.then(async (authInfo) => {
            if (!authInfo.token) return;
            const verification = await probeBridgeAuth(BRIDGE_URL, authInfo.token);
            if (verification === "none") {
                logger.info(
                    `Token verified — ioBridge accepted authentication for "${authInfo.user}"`,
                );
            } else {
                logger.warn(
                    `Token verification failed (${verification}) — io.Bridge may reject the mesh connection`,
                );
            }
        });
    },
});
