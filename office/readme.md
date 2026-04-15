# Browser ↔ Office Integration via io.Bridge

This example demonstrates how to integrate web applications with Microsoft Office (Outlook, Excel) using **io.Bridge** — the interoperability mesh that connects browser-based and desktop applications.

## Overview

A React web app hosted in **io.Connect Browser** communicates with Office add-ins running on the desktop — both connected to the same **io.Bridge** instance. io.Bridge can run locally (via the `@interopio/bridge` npm package) or be deployed in the cloud. The **desktop gateway server** (`@interopio/gateway-server`) must run locally on the user's machine so that Office add-ins can discover it via named pipe. The **browser platform** has an embedded gateway that is configured to connect to the same io.Bridge instance, forming a cluster where interop method calls (e.g. *create an email*, *push data to Excel*) travel seamlessly between browser and desktop.

### Components

| Component | Package / Source | Role |
|---|---|---|
| **io.Bridge** | `@interopio/bridge` | Interop mesh — routes messages between gateways (runs locally or in the cloud) |
| **Desktop Gateway** | `@interopio/gateway-server` | Runs locally; connects to io.Bridge; Office add-ins connect to it via WebSocket |
| **Web App** | `@interopio/home-ui-react` + `@interopio/browser-platform` | Browser platform with embedded gateway; connects to the same io.Bridge |
| **Outlook Add-in** | [outlook-v1.318.0.0](https://github.com/InteropIO/iocd-components/releases/download/outlook-v1.318.0.0-win32/outlook-v1.318.0.0-win32.zip) | .NET add-in with interop client; registers methods for email (e.g. `T42.Outlook.CreateEmail`) |
| **Excel Add-in** | [excel-v2.26.0331.1210](https://github.com/InteropIO/iocd-components/releases/download/excel-v2.26.0331.1210-win32/excel-v2.26.0331.1210-win32.zip) | .NET add-in (v2) with interop client; registers methods for spreadsheet operations |
| **Auth0** (optional) | `@auth0/auth0-react` | SSO authentication for bridge and browser |

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Browser (HTTPS — GitHub Pages or localhost:5173)               │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Web App  (@interopio/home-ui-react)                     │  │
│  │  ├─ Embedded Gateway ────────────────────┐               │  │
│  │  ├─ Outlook Demo (child app)             │               │  │
│  │  └─ Excel Playground (child app)         │               │  │
│  └──────────────────────────────────────────┼───────────────┘  │
└─────────────────────────────────────────────┼──────────────────┘
                                              │ WSS
                                              ▼
                    ┌──────────────────────────────────────────┐
                    │  io.Bridge  (@interopio/bridge)          │
                    │  local: https://localhost:8084            │
                    │  — or cloud-hosted —                      │
                    └──────────────────────────────────────────┘
                                              ▲ WSS
                                              │
┌─────────────────────────────────────────────┼──────────────────┐
│  Desktop  (Windows — must run locally)      │                  │
│  ┌──────────────────────────────────────────┼───────────────┐  │
│  │  Gateway Server  (@interopio/gateway-server)             │  │
│  │  ws://127.0.0.1:8385                     │               │  │
│  │  ├─ Mesh connection to io.Bridge ────────┘               │  │
│  │  └─ Named pipe (optional add-in discovery)               │  │
│  └──────────────────────────────────────────┬───────────────┘  │
│                       ┌─────────────────────┼──────────┐       │
│                       │  WebSocket          │          │       │
│                       ▼                     ▼          ▼       │
│                 ┌──────────┐         ┌──────────┐  ┌───────┐   │
│                 │ Outlook  │         │  Excel   │  │  ...  │   │
│                 │ Add-in   │         │  Add-in  │  │       │   │
│                 └──────────┘         └──────────┘  └───────┘   │
└─────────────────────────────────────────────────────────────────┘
```

## Prerequisites

- **Windows 10/11**
- **Node.js ≥ 24**
- **Microsoft Outlook** (2016+) and/or **Microsoft Excel** (2016+)
- **io.Bridge license key** (`IO_BRIDGE_LICENSE_KEY`)
- **io.Connect Browser license key** (`VITE_IO_CB_LICENSE_KEY`)
- *(Optional)* Auth0 tenant for SSO

## Quick Start

The demo web app is already deployed on GitHub Pages at **[https://interopio.github.io/bridge-examples/](https://interopio.github.io/bridge-examples/)**, pre-configured with Auth0 and connected to the cloud-hosted io.Bridge instance at `https://gw-bridge-examples.interop.io`. To try it out you only need to run a few things locally:

### 1. Install Office Add-ins

Download and install the add-ins. They are .NET apps with an embedded interop client that connects to the desktop gateway via WebSocket (optionally discovered via named pipe):

```powershell
# Outlook
Invoke-WebRequest -Uri "https://github.com/InteropIO/iocd-components/releases/download/outlook-v1.318.0.0-win32/outlook-v1.318.0.0-win32.zip" -OutFile outlook.zip
Expand-Archive outlook.zip -DestinationPath .\outlook-addin
.\outlook-addin\GlueInstaller.cmd

# Excel
Invoke-WebRequest -Uri "https://github.com/InteropIO/iocd-components/releases/download/excel-v2.26.0331.1210-win32/excel-v2.26.0331.1210-win32.zip" -OutFile excel.zip
Expand-Archive excel.zip -DestinationPath .\excel-addin
.\excel-addin\_install_gluexl.cmd
```

### 2. Configure the Excel v2 Add-in

The Excel v2 add-in defaults to connecting via io.Connect Desktop, which is not used in this example. Copy the provided configuration to make it connect directly to the desktop gateway instead:

```powershell
Copy-Item .\ioxl2_config.json .\excel-addin\ioxl2_config.json
```

The key settings in [`ioxl2_config.json`](./ioxl2_config.json):

| Setting | Value | Why |
|---|---|---|
| `includedFeatures` | `UseContexts,UseAppManager` | Only enable features available without io.Connect Desktop |
| `disable-await-and-track` | `""` | Disable dependency tracking (no io.Connect Desktop) |
| `forced-options.environment` | `DEMO` | Match the gateway's `IO_CD_ENV` |
| `forced-options.region` | `INTEROP.IO` | Match the gateway's `IO_CD_REGION` |
| `forced-options.gwUrl` | `ws://127.0.0.1:8385` | Connect directly to the desktop gateway |
| `skip` | `register-own-application;backend-instance;...` | Skip steps that require io.Connect Desktop services |

### 3. Start the desktop gateway

```bash
cd office
npm install
npm run start:gateway
```

The gateway connects to the cloud-hosted io.Bridge and exposes a local WebSocket endpoint (`ws://127.0.0.1:8385`) for the Office add-ins.

### 4. Open Outlook and/or Excel

Launch Microsoft Outlook (and/or Excel). The installed add-ins will automatically connect to the desktop gateway.

### 5. Open the demo web app

Navigate to **[https://interopio.github.io/bridge-examples/](https://interopio.github.io/bridge-examples/)**. Log in via Auth0, then launch the **Outlook Demo** or **Excel Playground** child apps from the launcher. Emails sent from the browser will appear as drafts in Outlook.

---

## Local Development

If you want to run everything locally (including io.Bridge and the web app):

### 1. Install dependencies

```bash
cd office
npm install
```

### 2. Set up Auth0

Follow the [`auth0/readme.md`](./auth0/readme.md) guide to create your own Auth0 account, API (audience), SPA application, Form, and Post-Login Action.

### 3. Configure environment

Copy the example env file and fill in your license keys and Auth0 settings:

```bash
cp .env.example .env
```

At minimum set:

```dotenv
IO_BRIDGE_LICENSE_KEY=<your-bridge-license>
VITE_IO_CB_LICENSE_KEY=<your-browser-platform-license>

# Auth0 (from step 2)
VITE_AUTH0_DOMAIN=<your-tenant>.auth0.com
VITE_AUTH0_CLIENT_ID=<your-spa-client-id>
VITE_AUTH0_AUDIENCE=io.bridge
```

See [`.env.example`](.env.example) for the full list of options (CORS, logging, etc.).

### 4. Start everything

```bash
# Start io.Bridge + Gateway Server + Vite dev server
npm start
```

Or run components individually:

| Script | What it starts |
|---|---|
| `npm run start:bridge` | io.Bridge on `https://localhost:8084` |
| `npm run start:gateway` | Desktop gateway on `ws://127.0.0.1:8385` |
| `npm run start:web` / `npm run dev` | Vite dev server on `http://localhost:5173` |
| `npm run start:no-gateway` | Bridge + Web (no desktop gateway) |
| `npm run start:no-bridge` | Gateway + Web (use remote bridge) |

### 5. Open the browser and use

Navigate to `http://localhost:5173`. Log in via Auth0, then launch the **Outlook Demo** or **Excel Playground** child apps from the launcher.

## Project Structure

```
office/
├── .env.example                  # All configurable environment variables
├── package.json                  # Scripts & dependencies
├── gateway-server.config.ts      # Desktop gateway server configuration
├── vite.config.ts                # Vite build config (multi-page: main + outlook)
├── ioxl2_config.json             # Excel v2 add-in config (gateway URL, features, skip list)
├── auth0/                        # Auth0 integration for gateway & license injection
│   ├── app.ts                    # Auth Code + PKCE OAuth2 endpoints for gateway
│   ├── interop_licenses.json     # Auth0 Form definition (license key prompt)
│   ├── interop_licenses.js       # Auth0 Post-Login Action (injects license claim)
│   ├── readme.md                 # Auth0 setup guide
│   └── success.html              # Post-login success page
├── src/
│   ├── index.html                # Main entry — io.Connect Browser platform
│   ├── main.tsx                  # React root
│   ├── App.tsx                   # IOConnectHome bootstrap & platform config
│   ├── config.json               # Channels, environment
│   ├── index.css                 # Global reset
│   └── outlook/                  # Outlook Demo child application
│       ├── index.html
│       ├── main.tsx              # IOConnectProvider (browser client)
│       ├── OutlookApp.tsx        # Email form + io.Connect interop
│       ├── OutlookApp.css        # Outlook app styles
│       └── components/
│           └── EmailForm.tsx     # Email composition & T42.Outlook.CreateEmail invocation
└── public/
    └── static/modals/            # Modal UI assets (copied from @interopio/modals-ui)
```

## How It Works

### Browser → Bridge → Desktop flow

1. The **web app** initializes `@interopio/browser-platform` which starts an in-browser gateway and connects to io.Bridge via WebSocket.
2. The **desktop gateway** (`@interopio/gateway-server`) also connects to io.Bridge via its mesh configuration.
3. **Office add-ins** (Outlook, Excel) are .NET applications with an embedded interop client. They connect to the desktop gateway via **WebSocket** and can optionally discover it via a **named pipe**. Once connected, they register interop methods (e.g. `T42.Outlook.CreateEmail`).
4. The browser child app calls `io.interop.invoke("T42.Outlook.CreateEmail", { To, Subject, Body })` — the call travels through io.Bridge to the Outlook add-in, which creates a draft email in Outlook.

### Method availability detection

The Outlook Demo child app uses `io.interop.serverMethodAdded()` / `serverMethodRemoved()` to track whether the `T42.Outlook.CreateEmail` method is available. The **Send** button stays disabled until a server (Outlook add-in) registers the method, and the UI shows which machine the server is running on.

### Visibility rules

Both the browser platform config (`App.tsx`) and the desktop gateway config (`gateway-server.config.ts`) define **visibility rules** that control which interop methods, contexts, and peers are shared across the cluster vs. kept local:

- Methods from `Outlook` and `IOXLAddin` identities → **cluster** (shared via bridge)
- Internal `T42.*` methods → **local** only
- Channel contexts → **cluster**; workspace/window contexts → **local**

## Configuration Reference

### Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| **io.Bridge** ||||
| `IO_BRIDGE_LICENSE_KEY` | Yes | — | License key for io.Bridge server |
| `IO_BRIDGE_SERVER_PORT` | No | `8084` | Port for io.Bridge |
| `IO_BRIDGE_SERVER_HOST` | No | `0.0.0.0` | Bind address for io.Bridge |
| `IO_BRIDGE_SERVER_AUTH_TYPE` | No | `none` | Auth type: `none`, `basic`, `oauth2` |
| `IO_BRIDGE_SERVER_AUTH_OAUTH2_JWT_ISSUERURI` | If oauth2 | — | OAuth2 JWT issuer URI (used by io.Bridge for token validation) |
| `IO_BRIDGE_SERVER_AUTH_OAUTH2_JWT_AUDIENCE` | If oauth2 | — | OAuth2 JWT audience (used by io.Bridge for token validation) |
| **Web App (Vite)** ||||
| `VITE_IO_CB_LICENSE_KEY` | If no Auth0 | — | License key for io.Connect Browser Platform (with Auth0, injected via token claim instead) |
| `VITE_IO_BRIDGE_URL` | No | `https://gw-bridge-examples.interop.io` | Bridge URL for browser platform connection |
| `VITE_AUTH0_DOMAIN` | If Auth0 | — | Auth0 tenant domain |
| `VITE_AUTH0_CLIENT_ID` | If Auth0 | — | Auth0 SPA client ID |
| `VITE_AUTH0_AUDIENCE` | If Auth0 | — | Auth0 API audience |
| `VITE_AUTH0_SCOPE` | No | `openid profile email` | Auth0 scopes for the browser app |
| **Desktop Gateway** | | | *Falls back to `IO_BRIDGE_*` then `VITE_*` if not set* |
| `IO_GATEWAY_BRIDGE_URL` | No | `VITE_IO_BRIDGE_URL` | Bridge URL for the gateway mesh connection |
| `IO_GATEWAY_AUTH_ISSUERURI` | No | `IO_BRIDGE_*` → `https://<VITE_AUTH0_DOMAIN>` | Auth0 issuer URI for the gateway |
| `IO_GATEWAY_AUTH_CLIENT_ID` | No | `VITE_AUTH0_CLIENT_ID` | Auth0 client ID for the gateway |
| `IO_GATEWAY_AUTH_AUDIENCE` | No | `IO_BRIDGE_*` → `VITE_AUTH0_AUDIENCE` | Auth0 audience for the gateway |
| `IO_GATEWAY_AUTH0_SCOPE` | No | `openid email offline_access` | Auth0 scopes for the gateway (`offline_access` enables token refresh) |
| **Logging** ||||
| `LOGGING_LEVEL` | No | `info` | Log level: `trace`, `debug`, `info`, `warn`, `error`, `off` |

### Gateway Server (`gateway-server.config.ts`)

The gateway server uses `defineConfig()` from `@interopio/gateway-server/config`. Key settings:

- **`host`** / **`port`**: `127.0.0.1:8385` — only accessible locally
- **`gateway.mesh`**: Connects to io.Bridge at the configured URL
- **`management.server.path`**: Named pipe for gateway management (e.g. `\\.\pipe\gateway-server-DEMO-INTEROP.IO-<user>`)
- **`gateway.methods.visibility`** / **`gateway.contexts.visibility`**: Control what's shared across the mesh

**Auth detection:** On startup the gateway probes `POST <bridge_url>/api/nodes` with `[]`. If io.Bridge responds 2xx, no authentication is needed and the gateway proceeds with the local OS username. If the response is 4xx/5xx (auth required), the gateway registers Auth0 routes and opens the login page in the system browser. After the token is received, it is optionally verified against the same endpoint before the mesh connection is established.

### Browser Platform (`App.tsx`)

Configured via `IOConnectHome` with `getIOConnectConfig` callback:

- **`browserPlatform.config.gateway.bridge.url`**: Points to io.Bridge
- **`browserPlatform.config.gateway.bridge.interop.visibility`**: Only Outlook/Excel methods are shared cluster-wide
- **`browserPlatform.config.applications.local`**: Defines child apps (Outlook Demo, Excel Playground)

## Auth0 Integration (Optional)

When Auth0 is configured, both the browser and the desktop gateway authenticate via Auth0:

- **Browser**: Uses `@auth0/auth0-react` — the `IOConnectHome` login type is set to `"auth0"`
- **Desktop Gateway**: Uses the Authorization Code + PKCE flow — opens Auth0 Universal Login in the system browser, exchanges the code for access + refresh tokens, and automatically refreshes the access token before it expires
- **License Injection**: An Auth0 post-login Action collects the io.Connect Browser license key (via a custom Form on first login) and injects it as a custom claim (`https://interop.io/io_cb_license_key`) in the ID token — removing the need to set `VITE_IO_CB_LICENSE_KEY` in the environment

To enable, set all `VITE_AUTH0_*` and `IO_BRIDGE_SERVER_AUTH_*` variables in `.env`. For the full Auth0 setup walkthrough (tenant, API, SPA, Form, Action), see [`auth0/readme.md`](./auth0/readme.md).

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| "Waiting for Outlook..." in the email form | Outlook add-in not connected | Ensure gateway server is running and Outlook add-in is installed |
| Bridge connection refused | Bridge not running or wrong port | Check `npm run start:bridge` and `VITE_IO_BRIDGE_URL` |
| "Missing user details" error | No `user` property in platform config | Ensure login flow returns user data |
| React error #525 on production build | Multiple React instances from linked packages | The `resolve.dedupe` and `resolve.alias` in `vite.config.ts` handle this |
| Auth0 login loop | Misconfigured callback URLs | Ensure Auth0 app has `http://localhost:5173` in Allowed Callback URLs |

## Notes

- **io.Bridge** can run locally (via `@interopio/bridge` npm package) or be deployed in the cloud. For production cluster deployment, see the [Docker](../docker/) examples. What **must** run locally is the **desktop gateway server** — Office add-ins connect to it via WebSocket (and can optionally discover it via named pipe).
- **io.Connect Browser** has an embedded gateway that connects to the same io.Bridge instance as the desktop gateway, forming a single interop cluster.
- The `index.css` provides a minimal global reset used by all pages; Outlook-specific styles are in `OutlookApp.css`.
- Some dependencies (`@interopio/browser`, `@interopio/core`, `@interopio/search-api`) use `file:` links to a local `connect-js` checkout for development. For standalone use, replace them with published npm versions.
