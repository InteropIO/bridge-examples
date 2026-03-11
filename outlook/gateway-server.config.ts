import { tmpdir } from 'node:os';
import opener from 'opener';

import * as IOGatewayLogging from '@interopio/gateway/logging/core';
import type { ServerConfigurer } from '@interopio/gateway-server/web/server';

import type { Auth0FlowData } from './gateway-server-helpers/auth0.ts';
import { auth0 } from './gateway-server-helpers/auth0.ts';

const auth0FlowData: Auth0FlowData = {};

const host = '127.0.0.1';
const port = '8385'; // same port as glue42

process.loadEnvFile();

export default {
    host,
    port,
    cors: false,
    auth: {
        type: 'none',
    },

    gateway: {
        contexts: {
            visibility: [
                { restrictions: "cluster", identity: { method: /.*/ } }
            ],
        },

        methods: {
            visibility: [
                {
                    identity: {
                        application: "java-demo-channels"
                    },
                    restrictions: "cluster"
                },
                { 
                    restrictions: "local" 
                }
            ]
        },

        peers: {
            visibility: [
                { domain: 'agm', restrictions: 'cluster' }
            ]
        },

        mesh: {
            enabled: true,

            auth: {
                // auth0 config and data
            },
            cluster: {

                endpoint: `http://${process.env.IO_BRIDGE_SERVER_HOST ?? 'localhost'}:${process.env.IO_BRIDGE_SERVER_PORT ?? '8084'}`, // bridge
                opts: {
                    getHeaders() {
                        const headers: Record<string, string> = {};
                        if (auth0FlowData.access_token) {
                            headers["Authorization"] = `Bearer ${auth0FlowData.access_token}`;
                        }
                        return headers;
                    },
                    getWebSocketSearchParams() {
                        const params: Record<string, string> = {};
                        if (auth0FlowData.access_token) {
                            params["access_token"] = `${auth0FlowData.access_token}`;
                        }
                        return params;
                    }
                },
            },

        },

    },

    management: {
        server: {
            path: (() => {
                if (process.platform === 'win32') {
                    return `\\\\.\\pipe\\gateway-server-DEMO-INTEROP.IO-${process.env.USERNAME}`;
                } else {
                    return `${tmpdir()}/gateway-server-DEMO-INTEROP.IO-${process.env.USER}.sock`;
                }
            })()
        },
        commands: {
            shutdown: {
                enabled: true,
            }
        }
    },

    app: async (configurer: ServerConfigurer) => {

        await auth0(
            {
                logger: IOGatewayLogging.getLogger('gateway.bridge.auth0'),
                auth0FlowData,
                domain: process.env.VITE_AUTH0_DOMAIN ?? '<placeholder-for-missing-env-variable>',
                clientId: process.env.VITE_AUTH0_CLIENT_ID ?? '<placeholder-for-missing-env-variable>',
                audience: process.env.VITE_AUTH0_AUDIENCE ?? '<placeholder-for-missing-env-variable>',
                scopes: process.env.VITE_AUTH0_SCOPES ?? '<placeholder-for-missing-env-variable>'
            },
            configurer
        );

    }
};

opener(`http://${host === '127.0.0.1' ? 'localhost' : host}:${port}/login/auth0`);