import IOBrowserPlatform from "@interopio/browser-platform";
import { IOConnectHome, type UserData, type Auth0User } from "@interopio/home-ui-react";
import type { IOConnectInitSettings } from "@interopio/react-hooks";
import IOModals from "@interopio/modals-api";
import IOSearch from "@interopio/search-api";
import IOWorkspaces from "@interopio/workspaces-api";
import "@interopio/workspaces-ui-react/dist/styles/workspaces.css";
import "@interopio/home-ui-react/index.css";
import config from "./config.json";

const appBaseUrl = new URL(import.meta.env.BASE_URL, window.location.origin);
const appBasePath = appBaseUrl.pathname;
const outlookAppUrl = new URL("outlook/", appBaseUrl).toString();
const modalsBaseUrl = new URL("static/modals/", appBaseUrl);

function requireNonEmptyString(value: string | undefined, name: string): string {
    if (!value || value.trim() === "") {
        throw new Error(`Environment variable ${name} is required and cannot be empty.`);
    }
    return value;
}

const getConfig = (userData: UserData): IOConnectInitSettings => {
    const bridgeUrl = import.meta.env.VITE_IO_BRIDGE_URL || "https://gw-bridge-examples.interop.io";
    const licenseKey = (userData.type === "auth0" ? userData.user["https://interop.io/io_cb_license_key"] as string : undefined) ?? import.meta.env.VITE_IO_CB_LICENSE_KEY as string;

    // Extract user details from login
    const user: Auth0User = userData.user as Auth0User;

    // Platform configuration
    return {
        browserPlatform: {
            factory: async (platformConfig) => {
                const platformInit = await IOBrowserPlatform(platformConfig);

                (window as any).io = platformInit.io;
                (window as any).platform = platformInit.platform;

                return platformInit;
            },
            config: {
                // License key from environment
                licenseKey,
                environment: config.environment,
                applications: {
                    local: [
                        {
                            name: "outlook-demo",
                            type: "window",
                            title: "Outlook Demo",
                            details: {
                                url: outlookAppUrl,
                            },
                            customProperties: {
                                includeInWorkspaces: true
                            }
                        },
                        {
                            name: "excel-playground",
                            type: "window",
                            "title": "Excel Playground",
                            details: {
                                url: "https://interopio.github.io/excel-playground/"
                            },
                            customProperties: {
                                includeInWorkspaces: true
                            }
                        }
                    ]
                },
                layouts: {
                    mode: "idb",
                    local: [{
                        name: "Welcome",
                        type: "Global",
                        components: [{
                            type: "workspaceFrame",
                            componentType: "application",
                            application: "workspaces-demo",
                            state: {
                                bounds: {
                                    top: 0,
                                    left: 0,
                                    height: 0,
                                    width: 0,
                                },
                                context: {
                                    isPlatform: true,
                                },
                                instanceId: "g42-welcome",
                                selectedWorkspace: 0,
                                workspaces: [{
                                    children: [{
                                        type: "row",
                                        config: {},
                                        children: [
                                            {
                                                type: "group",
                                                config: {},
                                                children: [{
                                                    type: "window",
                                                    config: {
                                                        title: "Outlook",
                                                        appName: 'outlook-demo',
                                                        url: `${outlookAppUrl}`
                                                    }
                                                }]
                                            },
                                            {
                                                type: "group",
                                                config: {},
                                                children: [
                                                    {
                                                        type: "window",
                                                        config: {
                                                            title: "Excel",
                                                            appName: "excel-playground",
                                                            url: "https://interopio.github.io/excel-playground/"
                                                        }
                                                    }
                                                ]
                                            }],
                                    }],
                                    config: {
                                        name: "Office"
                                    },
                                    context: {}
                                }]
                            }
                        }]
                    }
                    ]
                },
                channels: {
                    definitions: config.channels
                },
                browser: {
                    libraries: [IOWorkspaces, IOModals, IOSearch],
                    modals: {
                        dialogs: {
                            enabled: true
                        },
                        alerts: {
                            enabled: true
                        }
                    },
                    systemLogger: {
                        level: "warn"
                    },
                    intentResolver: {
                        enable: true
                    }
                },
                modals: {
                    sources: {
                        bundle: new URL("io-browser-modals-ui.es.js", modalsBaseUrl).toString(),
                        styles: [new URL("styles.css", modalsBaseUrl).toString()],
                        fonts: [new URL("fonts.css", modalsBaseUrl).toString()]
                    }
                },

                // Gateway configuration - connect to local io.Bridge
                gateway: {
                    logging: {
                        level: "warn",
                        appender: (info) => {
                            console.log(`[${info.namespace}]: ${info.message}`);
                        },
                    },
                    bridge: {
                        url: bridgeUrl,
                        search: {
                            enabled: true,
                        },
                        interop: {
                            enabled: true,
                            visibility: [
                                {
                                    restrictions: "cluster",
                                    identity: { application: new RegExp(/(Outlook|IOXLAddin)/) }
                                },
                            ]
                        },
                        async getHeaders() {
                            const headers: Record<string, string> = {};
                            if (userData && userData.type === "auth0") {
                                headers["Authorization"] = `Bearer ${userData.user.token}`;
                            }
                            return headers;
                        },
                        getWebSocketSearchParams() {
                            const params: Record<string, string> = {};
                            if (userData && userData.type === "auth0") {
                                params["access_token"] = `${userData.user.token}`;
                            }
                            return params;
                        }
                    }
                },
                // User details required when connecting to io.Bridge
                user: {
                    id: user.id,
                    username: user.name,
                    firstName: user.given_name,
                    lastName: user.family_name,
                    email: user.email
                },
                // Workspaces App configuration
                workspaces: {
                    src: appBasePath,
                    isFrame: true
                }
            }
        }
    };
};

// Configuration for the IOConnectHome component
const homeConfig = {
    getIOConnectConfig: getConfig,
    // Auth0 authentication - users must log in via Auth0
    login: {
        type: "auth0" as const,
        providerOptions: {
            domain: requireNonEmptyString(import.meta.env.VITE_AUTH0_DOMAIN, "VITE_AUTH0_DOMAIN"),
            clientId: requireNonEmptyString(import.meta.env.VITE_AUTH0_CLIENT_ID, "VITE_AUTH0_CLIENT_ID"),
            authorizationParams: {
                audience: requireNonEmptyString(import.meta.env.VITE_AUTH0_AUDIENCE, "VITE_AUTH0_AUDIENCE"),
                scope: import.meta.env.VITE_AUTH0_SCOPE ?? "openid profile email",
                redirect_uri: appBaseUrl.toString(),
            }
        },
    }
};

function App() {
    return <IOConnectHome config={homeConfig}/>;
}

export default App;
