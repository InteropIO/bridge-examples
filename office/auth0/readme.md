# Auth0 Setup for io.Bridge Authentication

When io.Bridge is configured with `IO_BRIDGE_SERVER_AUTH_TYPE=oauth2`, both the **desktop gateway** and the **browser platform** must authenticate with a Bearer token. This guide walks through the Auth0 setup required to make that work.

## 1. Create an Auth0 Account

1. Go to [https://auth0.com](https://auth0.com) and sign up for a free account.
2. During signup you will be asked to create a **tenant** — choose a name (e.g. `my-company`). This determines your Auth0 domain: `my-company.auth0.com` (or `my-company.eu.auth0.com` for EU tenants).
3. Once the dashboard loads, note your **Auth0 Domain** — you will need it for the `.env` configuration.

## 2. Create an API (Audience)

The API represents the resource that tokens will be issued for — in this case, **io.Bridge**.

1. In the Auth0 Dashboard navigate to **Applications → APIs**.
2. Click **+ Create API**.
3. Fill in the details:
   - **Name**: `io.Bridge` (display name — can be anything descriptive)
   - **Identifier (Audience)**: `io.bridge` (this is the logical identifier, not a URL — it must match `IO_BRIDGE_SERVER_AUTH_OAUTH2_JWT_AUDIENCE` in your `.env`)
   - **Signing Algorithm**: `RS256` (default)
4. Click **Create**.
5. Go to the **Settings** tab of the newly created API.
6. Enable **Allow Offline Access** — this allows the desktop gateway to request a refresh token (via the `offline_access` scope) so it can automatically renew expired access tokens without requiring the user to log in again.
7. Click **Save**.
8. Note the **Identifier** value — this is your **audience**.

### Configuration mapping

| Auth0 field | `.env` variable |
|---|---|
| Identifier (Audience) | `IO_BRIDGE_SERVER_AUTH_OAUTH2_JWT_AUDIENCE` / `VITE_AUTH0_AUDIENCE` |

## 3. Create a Single-Page Application (SPA)

The SPA application is used by both the **browser platform** (via `@auth0/auth0-react`) and the **desktop gateway** (via the Authorization Code + PKCE flow registered in `auth0/app.ts`).

1. In the Auth0 Dashboard navigate to **Applications → Applications**.
2. Click **+ Create Application**.
3. Fill in the details:
   - **Name**: `io.Connect Bridge Example` (or any descriptive name)
   - **Application Type**: **Single Page Application**
4. Click **Create**.
5. Go to the **Settings** tab of the newly created application.
6. Note the **Client ID** and **Domain** — you will need them for `.env`.
7. Go to the **APIs** tab and find the **io.Bridge** API (created in step 2). Enable **User access** (Authorization Code) — this authorizes the application to request tokens for the io.Bridge API on behalf of users.

### 3.1. Configure Callback URLs and Web Origins

Still on the **Settings** tab, scroll down to the **Application URIs** section and configure the following:

#### Allowed Callback URLs

These are the URLs Auth0 will redirect to after login. Add all URLs where the gateway server or the browser app might be running:

```
http://localhost:8385/login/oauth2/code/auth0,
http://localhost:5173,
https://<your-github-pages-domain>
```

- `http://localhost:8385/login/oauth2/code/auth0` — the desktop gateway's Auth0 callback endpoint (authorization code + PKCE with `response_mode=form_post`)
- `http://localhost:5173` — the Vite dev server (browser platform login)
- Add any additional deployed URLs (e.g. GitHub Pages) as needed

#### Allowed Web Origins

These origins are required for silent token renewal and CORS:

```
http://localhost:5173,
http://localhost:8385,
https://<your-github-pages-domain>
```

#### Allowed Logout URLs *(optional)*

If you want logout to redirect back to the app:

```
http://localhost:5173,
https://<your-github-pages-domain>
```

7. Scroll down and click **Save Changes**.

### Configuration mapping

| Auth0 field | `.env` variable |
|---|---|
| Domain | `VITE_AUTH0_DOMAIN` |
| Client ID | `VITE_AUTH0_CLIENT_ID` |

### 3.2. Create a Form for License Key Input

Auth0 Forms let you collect additional information from users during the login flow. We use a form to prompt the user for their **io.Connect Browser license key**, which is then injected into the token by a post-login Action.

1. In the Auth0 Dashboard navigate to **Actions → Forms**.
2. Click **+ Create Form** → **Import**.
3. Paste the contents of [`interop_licenses.json`](./interop_licenses.json) (included in this repository) and import it.
4. The form contains a single step with a **Password** field (`io_cb_license_key`) labelled *"io.Connect Browser License Key"* and a **Continue** button.
5. Click **Save** and **Publish** the form.

> **Note:** The form field ID `io_cb_license_key` is important — it is referenced by the post-login Action below and maps to the token claim `https://interop.io/io_cb_license_key` that the browser platform reads.

### 3.3. Create a Post-Login Action to Inject the License

Auth0 Actions let you run custom logic during the login flow. We create a **Login / Post Login** action that:

1. Only runs for specific applications (matched by **Client ID**).
2. On first login, renders the license key form (from step 3.2) to collect the key.
3. Stores the submitted license key in `user.app_metadata` so the user is not prompted again.
4. Injects the license key as a custom claim (`https://interop.io/io_cb_license_key`) in the **ID token** on every login.
5. Denies access if no license key is provided after the form.

#### Steps

1. In the Auth0 Dashboard navigate to **Actions → Library**.
2. Click **+ Create Action** → **Build from Scratch**.
3. Fill in:
   - **Name**: `Inject io.Connect Browser License` (or any descriptive name)
   - **Trigger**: **Login / Post Login**
   - **Runtime**: Node 22 (or latest available)
4. Paste the contents of [`interop_licenses.js`](./interop_licenses.js) (included in this repository), or use the code below:

```javascript
const CLAIM_NAMESPACE = 'https://interop.io';
const USE_SECRETS_LICENSE = false;
// List client IDs for applications that need licenses.
const CLIENT_IDS = [
    '' // ← replace with your SPA's Client ID (from step 3)
];

exports.onExecutePostLogin = async (event, api) => {
    if (CLIENT_IDS.includes(event.client.client_id)) {
        if (event.user.app_metadata && event.user.app_metadata.io_cb_license_key) {
            const io_cb_license_key = event.user.app_metadata.io_cb_license_key;
            if (io_cb_license_key) {
                api.idToken.setCustomClaim(`${CLAIM_NAMESPACE}/io_cb_license_key`, io_cb_license_key);
            }
        } else {
            // First login — render the form to collect the license key.
            api.prompt.render('FORM_ID'); // ← replace with your Form's ID
        }
    }
};

exports.onContinuePostLogin = async (event, api) => {
    if (CLIENT_IDS.includes(event.client.client_id)) {
        const io_cb_license_key = event.prompt?.fields?.io_cb_license_key
            ?? (USE_SECRETS_LICENSE ? event.secrets['IO_CB_LICENSE_KEY'] : undefined);

        if (io_cb_license_key) {
            api.user.setAppMetadata("io_cb_license_key", io_cb_license_key);
            api.idToken.setCustomClaim(`${CLAIM_NAMESPACE}/io_cb_license_key`, io_cb_license_key);
        } else {
            api.access.deny("io.Connect Browser License key required.");
        }
    }
};
```

5. Replace `'FORM_ID'` with the actual **Form ID** from the form created in step 3.2 (visible in **Actions → Forms → your form → Settings**).
6. Add your SPA's **Client ID** (from step 3) to the `CLIENT_IDS` array. This ensures the action only runs for your application.
7. *(Optional)* If you want to provide a fallback license via Auth0 Secrets instead of the form, set `USE_SECRETS_LICENSE = true` and add a secret named `IO_CB_LICENSE_KEY` in the action's **Secrets** tab.
8. Click **Deploy**.

#### Add the Action to the Login Flow

1. Navigate to **Actions → Flows → Login**.
2. Drag the **Inject io.Connect Browser License** action from the right panel into the flow, between **Start** and **Complete**.
3. Click **Apply**.

#### How the browser platform reads the claim

In `App.tsx`, the license key is extracted from the Auth0 user profile:

```typescript
const licenseKey = userData.user["https://interop.io/io_cb_license_key"] ?? import.meta.env.VITE_IO_CB_LICENSE_KEY;
```

When Auth0 login is used, the license key comes from the ID token claim. When using simple login (no Auth0), it falls back to the `VITE_IO_CB_LICENSE_KEY` environment variable.

## 4. Configure the `.env` File

After completing the Auth0 setup, update your `.env` with the values from above:

```dotenv
# io.Bridge authentication
IO_BRIDGE_SERVER_AUTH_TYPE=oauth2
IO_BRIDGE_SERVER_AUTH_OAUTH2_JWT_ISSUERURI=https://<your-tenant>.auth0.com/
IO_BRIDGE_SERVER_AUTH_OAUTH2_JWT_AUDIENCE=io.bridge

# Browser & gateway Auth0 settings
VITE_AUTH0_DOMAIN=<your-tenant>.auth0.com
VITE_AUTH0_CLIENT_ID=<your-spa-client-id>
VITE_AUTH0_AUDIENCE=io.bridge
```

## How It Works

On startup, the **desktop gateway** (`gateway-server.config.ts`) probes the bridge by sending `POST <bridge_url>/api/nodes` with an empty JSON array:

- **2xx response** → no authentication required; the gateway proceeds with the local OS username.
- **401 + `WWW-Authenticate: Bearer`** → authentication is required; the gateway starts the Authorization Code + PKCE flow (see below).
- **Other / unreachable** → the gateway logs a warning and proceeds without a token (the mesh will retry once the bridge becomes available).

### Authorization Code + PKCE flow

When authentication is required, the gateway:

1. Generates a **PKCE code verifier** and its SHA-256 **code challenge**.
2. Registers login (`/login/auth0`) and callback (`/login/oauth2/code/auth0`) routes on the local HTTP server.
3. Opens the Auth0 Universal Login page in the system browser with `response_type=code`, `response_mode=form_post`, and the PKCE challenge.
4. After the user authenticates, Auth0 POSTs the **authorization code** back to the callback endpoint.
5. The gateway exchanges the code (plus the PKCE verifier) for **access, ID, and refresh tokens** via `POST <issuerUrl>/oauth/token`.
6. The access token is used immediately for the mesh connection to io.Bridge.
7. A timer is scheduled to **refresh the access token** automatically (60 seconds before expiry) using the refresh token — so the gateway stays connected without requiring the user to log in again.

> **Note:** The `offline_access` scope and the API's **Allow Offline Access** setting (step 2.6) are both required for the refresh token to be issued.

> **Tip:** To test the refresh logic without waiting 24 hours, go to **Applications → APIs → io.Bridge → Settings** and lower both **Token Expiration (Seconds)** and **Token Expiration For Browser Flows (Seconds)** to the same value (e.g. `120` for 2 minutes) — the browser flow lifetime cannot exceed the maximum. The gateway refreshes 60 seconds before expiry. Remember to restore reasonable values afterwards.

The **browser platform** (`App.tsx`) uses `@auth0/auth0-react` with the `IOConnectHome` login type set to `"auth0"`, handling authentication entirely client-side.


