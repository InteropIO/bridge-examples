import { IOConnectBrowser } from "@interopio/browser";
import IOBrowserPlatform from "@interopio/browser-platform";
import { IOConnectHome, UserData } from "@interopio/home-ui-react";
import { IOConnectInitSettings } from "@interopio/react-hooks";
import IOWorkspaces from "@interopio/workspaces-api";
import "@interopio/home-ui-react/index.css";
import "@interopio/workspaces-ui-react/dist/styles/workspaces.css";
import './App.css';
import config from "./config.json";

const getConfig = (userData: UserData): IOConnectInitSettings => {
    const bridgeUrl = import.meta.env.VITE_IO_CB_BRIDGE_URL || 'http://localhost:8084';
    const licenseKey = import.meta.env.VITE_IO_CB_LICENSE_KEY || '';

    // Extract user details from login
    const user = userData.user;

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
                                url: `${window.location.href}outlook.html`,
                            },
                            customProperties: {
                                includeInWorkspaces: true
                            }
                        }
                    ]
                },
                layouts: {
                    mode: "idb"
                },
                channels: {
                    definitions: config.channels
                },
                browser: {
                    libraries: [IOWorkspaces],
                    systemLogger: {
                        level: "debug"
                    },
                    intentResolver: {
                        enable: true
                    }
                },

                // Gateway configuration - connect to local io.Bridge
                gateway: {

                    bridge: {
                        url: bridgeUrl,

                        interop: {
                            enabled: true,
                            visibility: [
                                { restrictions: 'cluster', method: /.*/ }
                            ]
                        }
                    }
                },
                // User details required when connecting to io.Bridge
                user: {
                    id: user?.id || 'anonymous',
                    username: user?.username || 'anonymous'
                },
                // Workspaces App configuration
                workspaces: {
                    src: "/",
                    isFrame: true
                }
            }
        }
    };
};

// Configuration for the IOConnectHome component
const homeConfig = {
    getIOConnectConfig: getConfig,
    // Simple login - no authentication required for this example
    login: {
        type: "simple" as const,
        onLogin: async (username: string, _password: string) => {
            // For this example, accept any user
            return {
                id: username,
                username
            };
        }
    }
};

function App() {
    return <IOConnectHome config={homeConfig}/>;
}

export default App;
