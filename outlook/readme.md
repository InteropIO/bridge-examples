# io.Bridge Outlook Integration Example

This example demonstrates how to use io.Bridge to send emails via Outlook from a web app hosted in io.Connect Browser.

## Overview

The example consists of:
- **Local io.Bridge** (`@interopio/bridge`): Local bridge instance running on 127.0.0.1
- **Desktop Gateway Server** (`@interopio/gateway-server`): Hosts a desktop gateway that connects to the local bridge and interfaces with Outlook
- **Browser Platform** (Web App): React-based UI using `@interopio/home-ui-react` that bootstraps `@interopio/browser-platform`
- **Outlook Component**: Downloaded from [InteropIO Outlook Component v1.318.0.0](https://github.com/InteropIO/iocd-components/releases/download/outlook-v1.318.0.0-win32/outlook-v1.318.0.0-win32.zip)
- **SSO Provider** (Optional): Third-party authentication (Auth0 or custom OAuth2/OIDC) for production-realistic demo

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Browser (HTTPS - GitHub Pages or localhost)                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Web App (@interopio/home-ui-react)                      │  │
│  │  ├─ In-Browser Gateway ──────────────────┐               │  │
│  │  └─ Email Compose UI                     │               │  │
│  └──────────────────────────────────────────┼───────────────┘  │
└─────────────────────────────────────────────┼──────────────────┘
                                              │
                                              ▼
                    ┌──────────────────────────────────────────┐
                    │  Local io.Bridge (@interopio/bridge)    │
                    │  Running on 127.0.0.1:8080               │
                    │  (Optional SSO Protection)               │
                    └──────────────────────────────────────────┘
                                              ▲
                                              │
┌─────────────────────────────────────────────┼──────────────────┐
│  Desktop (Windows - localhost)              │                  │
│  ┌──────────────────────────────────────────┼───────────────┐  │
│  │  Gateway Server (@interopio/gateway-server)              │  │
│  │  ├─ Desktop Gateway (connects to bridge) ┘               │  │
│  │  ├─ Named Pipe Discovery Service                         │  │
│  │  └─ OAuth2/OIDC Authentication (optional)                │  │
│  └──────────────────────────────────────────┬───────────────┘  │
│                                              │                  │
│  ┌──────────────────────────────────────────▼───────────────┐  │
│  │  Outlook Component (v1.318.0.0)                          │  │
│  │  ├─ GlueInstaller.cmd                                    │  │
│  │  └─ Connects via Named Pipe Discovery                    │  │
│  └──────────────────────────────────────────┬───────────────┘  │
│                                              │                  │
│  ┌──────────────────────────────────────────▼───────────────┐  │
│  │  Microsoft Outlook (COM/REST API)                        │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

**Note:** This example focuses on the integration concepts and runs everything locally. For production cluster deployment of io.Bridge, refer to the [Docker](../docker/readme.md) and [Kubernetes](../kubernetes/readme.md) examples.

## Tasks Breakdown

### Phase 1: Infrastructure Setup

#### Task 1.1: Local io.Bridge Setup
**Status:** ⏳ Not Started

**Description:** Set up local io.Bridge instance using `@interopio/bridge` package.

**Subtasks:**
- [ ] Create `bridge-local` package
- [ ] Install `@interopio/bridge` dependency
- [ ] Create bridge initialization script
- [ ] Configure to run on 127.0.0.1:8080
- [ ] Add license key configuration
- [ ] (Optional) Add JWT validation middleware for SSO demo
- [ ] Test bridge starts and accepts connections

**Configuration Example:**
```typescript
// bridge-local/src/index.ts
import { Bridge } from '@interopio/bridge';

const bridge = new Bridge({
  port: 8080,
  host: '127.0.0.1',
  licenseKey: process.env.IO_BRIDGE_LICENSE_KEY
});

await bridge.start();
console.log('io.Bridge running on 127.0.0.1:8080');
```

**Acceptance Criteria:**
- Bridge starts successfully on localhost
- Bridge accepts gateway connections
- License validation works
- Can be started/stopped easily for development

#### Task 1.2: Gateway Discovery via Named Pipe
**Status:** 🔄 In Progress (Implementation underway)

**Description:** Implement named pipe discovery service in the gateway-server package to allow the Outlook component to discover the desktop gateway.

**Subtasks:**
- [ ] Create named pipe server using `@interopio/gateway-server`
- [ ] Implement discovery protocol (gateway announces itself via named pipe)
- [ ] Configure named pipe name/location (e.g., `\\.\pipe\io-gateway-discovery`)
- [ ] Handle multiple gateway instances (if needed)
- [ ] Add error handling and reconnection logic

**Acceptance Criteria:**
- Outlook component can discover gateway via named pipe
- Gateway announces itself with connection details
- Connection persists across gateway restarts

#### Task 1.3: Desktop Gateway Server Configuration
**Status:** ⏳ Not Started

**Description:** Configure gateway-server using `@interopio/gateway-server` to connect to local bridge.

**Subtasks:**
- [ ] Create gateway-server package configuration
- [ ] Initialize gateway using `@interopio/gateway-server`
- [ ] Configure connection to local bridge (127.0.0.1:8080)
- [ ] Configure named pipe discovery service
- [ ] (Optional) Add OAuth2/OIDC authentication support
- [ ] Implement startup sequence: bridge connection → named pipe announcement

**Configuration Example:**
```typescript
// gateway-server/src/index.ts
import { GatewayServer } from '@interopio/gateway-server';

const gateway = new GatewayServer({
  bridge: {
    host: '127.0.0.1',
    port: 8080
  },
  discovery: {
    type: 'named-pipe',
    name: '\\\\.\\pipe\\io-gateway-discovery'
  },
  auth: {
    enabled: false  // or configure OAuth2 for demo
  }
});

await gateway.start();
```

**Acceptance Criteria:**
- Gateway connects to local bridge
- Named pipe discovery service is active
- Outlook component can discover and connect
- All components run on localhost

#### Task 1.4: SSO Configuration (Optional for Production Demo)
**Status:** ⏳ Not Started

**Description:** Add optional SSO authentication to demonstrate production-ready setup.

**Subtasks:**
- [ ] Choose SSO provider (Auth0 recommended)
- [ ] Add JWT validation to bridge
- [ ] Configure OAuth2 flow in gateway-server
- [ ] Configure OAuth2 flow in browser app
- [ ] Test authentication flow
- [ ] Document SSO setup steps

**Decision Points:**
- **Auth0 vs Custom:** Auth0 for simplicity, custom for flexibility
- **Demo Mode:** Allow running without SSO for simpler demo
- **Token Management:** Implement refresh token handling

**Acceptance Criteria:**
- Can run example with or without SSO
- SSO flow works when enabled
- Documentation covers both modes

### Phase 2: Desktop Gateway Authentication

#### Task 2.1: OAuth2/OIDC Flow in Gateway Server
**Status:** ⏳ Not Started

**Description:** Implement OAuth2/OIDC authentication flow in the gateway-server to handle SSO authentication.

**Subtasks:**
- [ ] Detect 401 response when connecting to io.Bridge
- [ ] Implement OAuth2 authorization code flow with PKCE
- [ ] Launch system browser for user authentication
- [ ] Create local HTTP server to receive callback (e.g., http://localhost:8080/callback)
- [ ] Exchange authorization code for access token
- [ ] Store and refresh access tokens securely
- [ ] Attach access token to bridge connection

**Authentication Flow:**
```
1. Gateway starts → Attempts to connect to io.Bridge
2. Receives 401 Unauthorized
3. Generates PKCE challenge
4. Opens browser: https://sso.example.com/authorize?client_id=...&redirect_uri=http://localhost:8080/callback
5. User authenticates in browser
6. Browser redirects to http://localhost:8080/callback?code=...
7. Gateway exchanges code for access token
8. Gateway connects to io.Bridge with token
9. Connection established
```

**Subtasks Detail:**
- [ ] Implement PKCE (Proof Key for Code Exchange) for security
- [ ] Handle browser launch cross-platform (Windows primarily)
- [ ] Implement callback server (temporary HTTP server)
- [ ] Store tokens securely (OS keychain/credential manager)
- [ ] Implement token refresh logic
- [ ] Handle authentication errors and retry logic

**Acceptance Criteria:**
- Gateway prompts for authentication on first run
- Browser opens automatically for user login
- Gateway receives and stores access token
- Gateway successfully connects to io.Bridge with valid token
- Token refresh works automatically

#### Task 2.2: Token Management and Persistence
**Status:** ⏳ Not Started

**Description:** Implement secure token storage and automatic refresh.

**Subtasks:**
- [ ] Use Windows Credential Manager for token storage
- [ ] Implement token expiration detection
- [ ] Implement automatic token refresh before expiration
- [ ] Handle refresh token expiration (re-authenticate)
- [ ] Add logout/revoke functionality

**Acceptance Criteria:**
- Tokens persist across gateway restarts
- Gateway doesn't prompt for auth if valid token exists
- Automatic refresh works transparently

### Phase 3: Browser Application

#### Task 3.1: Web App Scaffolding
**Status:** ⏳ Not Started

**Description:** Create React-based web application using `@interopio/home-ui-react`.

**Subtasks:**
- [ ] Initialize React project (Vite or Create React App)
- [ ] Install `@interopio/home-ui-react`
- [ ] Install `@interopio/browser-platform`
- [ ] Create basic project structure
- [ ] Configure build for production deployment

**Commands:**
```bash
npm create vite@latest outlook-bridge-app -- --template react-ts
cd outlook-bridge-app
npm install @interopio/home-ui-react @interopio/browser-platform
```

**Acceptance Criteria:**
- Project builds successfully
- Basic React app runs locally
- Dependencies installed correctly

#### Task 3.2: Browser Platform Initialization
**Status:** ⏳ Not Started

**Description:** Bootstrap `@interopio/browser-platform` within the web app.

**Subtasks:**
- [ ] Configure browser platform with io.Bridge cluster connection
- [ ] Configure authentication (Auth0 or custom OAuth2)
- [ ] Initialize in-browser gateway
- [ ] Configure gateway to connect to io.Bridge cluster
- [ ] Test connection and authentication flow

**Configuration Example:**
```typescript
import { IOConnectBrowserPlatform } from '@interopio/browser-platform';

const config = {
  gateway: {
    location: 'http://localhost:8080'  // Local bridge instance
  },
  auth: {
    // Optional: Enable for SSO demo
    enabled: false
    // provider: 'auth0',
    // config: {
    //   domain: 'your-tenant.auth0.com',
    //   clientId: 'your-client-id',
    //   redirectUri: window.location.origin
    // }
  }
};

await IOConnectBrowserPlatform(config);
```

**Acceptance Criteria:**
- Browser platform initializes successfully
- In-browser gateway connects to io.Bridge
- Authentication flow works in browser
- User can log in and access gateway

#### Task 3.3: Email Composition UI
**Status:** ⏳ Not Started

**Description:** Create UI components for composing and sending emails via Outlook.

**Subtasks:**
- [ ] Create email form component (To, Subject, Body)
- [ ] Add validation for email fields
- [ ] Add "Send Email" button
- [ ] Implement io.Connect method invocation to desktop gateway
- [ ] Add success/error notifications
- [ ] Add optional features (CC, BCC, Attachments)

**UI Components:**
- Email recipient field (with validation)
- Subject line input
- Rich text or plain text body editor
- Send button with loading state
- Status/error display

**Acceptance Criteria:**
- Form validates input properly
- Send button invokes interop method
- User receives feedback (success/error)
- UI is responsive and accessible

#### Task 3.4: Hosting Configuration
**Status:** ⏳ Not Started

**Description:** Configure hosting for the web application with HTTPS.

**Options:**
1. **GitHub Pages** (Static Hosting)
   - [ ] Configure GitHub Pages in repository settings
   - [ ] Set up custom domain (optional)
   - [ ] Configure HTTPS (automatic with GitHub Pages)
   - [ ] Add deployment workflow (GitHub Actions)

2. **Local Development with HTTPS**
   - [ ] Generate self-signed SSL certificates via gateway-server
   - [ ] Configure dev server to use HTTPS
   - [ ] Import certificates into browser trust store
   - [ ] Document certificate installation process

**Decision:** GitHub Pages is preferred for production-like demo, local HTTPS for development.

**GitHub Pages Setup:**
```yaml
# .github/workflows/deploy.yml
name: Deploy to GitHub Pages
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
      - run: npm install
      - run: npm run build
      - uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./dist
```

**Acceptance Criteria:**
- App is accessible via HTTPS
- GitHub Pages deployment works automatically
- Or local HTTPS setup is documented and working

### Phase 4: Outlook Integration

#### Task 4.1: Outlook Component Installation
**Status:** ⏳ Not Started

**Description:** Download, install, and configure the Outlook component.

**Subtasks:**
- [ ] Download outlook-v1.318.0.0-win32.zip
- [ ] Extract and document contents
- [ ] Run GlueInstaller.cmd with appropriate parameters
- [ ] Configure component to use named pipe discovery
- [ ] Verify component can discover gateway
- [ ] Test basic connectivity

**Installation Steps:**
```powershell
# Download
Invoke-WebRequest -Uri "https://github.com/InteropIO/iocd-components/releases/download/outlook-v1.318.0.0-win32/outlook-v1.318.0.0-win32.zip" -OutFile outlook.zip

# Extract
Expand-Archive -Path outlook.zip -DestinationPath .\outlook-component

# Install (modify GlueInstaller.cmd if needed to use named pipe discovery)
cd outlook-component
.\GlueInstaller.cmd
```

**Acceptance Criteria:**
- Component installed successfully
- Component discovers gateway via named pipe
- Component appears in Outlook

#### Task 4.2: Interop Method Implementation (Desktop)
**Status:** ⏳ Not Started

**Description:** Implement the interop method in the Outlook component to send emails.

**Subtasks:**
- [ ] Define interop method schema: `T42.Outlook.SendEmail`
- [ ] Implement method handler in Outlook component
- [ ] Use Outlook COM API or REST API to create email
- [ ] Handle parameters: to, subject, body, cc, bcc, attachments
- [ ] Return success/error status
- [ ] Add logging and error handling

**Method Schema:**
```typescript
interface SendEmailArgs {
  to: string | string[];
  subject: string;
  body: string;
  cc?: string | string[];
  bcc?: string | string[];
  attachments?: string[]; // File paths
  sendImmediately?: boolean; // true = send, false = show draft
}

interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}
```

**Acceptance Criteria:**
- Method registered and discoverable
- Can create draft email in Outlook
- Can send email immediately (if specified)
- Proper error handling for invalid emails

#### Task 4.3: Interop Method Invocation (Browser)
**Status:** ⏳ Not Started

**Description:** Implement method invocation from browser app to Outlook component.

**Subtasks:**
- [ ] Get io.Connect API reference in React app
- [ ] Implement `io.interop.invoke()` call
- [ ] Pass email parameters from form to method
- [ ] Handle async responses
- [ ] Display success/error messages to user
- [ ] Add loading/pending states

**Implementation Example:**
```typescript
const sendEmail = async (emailData: SendEmailArgs) => {
  try {
    const result = await io.interop.invoke('T42.Outlook.SendEmail', emailData);
    if (result.returned.success) {
      showSuccess('Email sent successfully!');
    } else {
      showError(result.returned.error || 'Failed to send email');
    }
  } catch (error) {
    showError('Failed to invoke Outlook: ' + error.message);
  }
};
```

**Acceptance Criteria:**
- Browser app can invoke desktop method
- Parameters passed correctly
- Success/error states handled properly
- User experience is smooth

### Phase 5: Testing & Documentation

#### Task 5.1: End-to-End Testing
**Status:** ⏳ Not Started

**Description:** Test the complete flow from browser to Outlook.

**Test Scenarios:**
- [ ] User authentication (browser and desktop)
- [ ] Gateway discovery via named pipe
- [ ] Browser platform connects to io.Bridge
- [ ] Desktop gateway connects to io.Bridge
- [ ] Method registration and discovery
- [ ] Email sending (draft mode)
- [ ] Email sending (immediate send)
- [ ] Error scenarios (invalid email, Outlook not running, etc.)
- [ ] Reconnection after network interruption
- [ ] Token refresh and re-authentication

**Acceptance Criteria:**
- All test scenarios pass
- Error handling works as expected
- System recovers from failures gracefully

#### Task 5.2: Documentation
**Status:** ⏳ Not Started

**Description:** Create comprehensive documentation for the example.

**Subtasks:**
- [ ] Update this README with setup instructions
- [ ] Document prerequisites (Outlook version, Windows version, etc.)
- [ ] Document SSO provider setup
- [ ] Document gateway-server configuration
- [ ] Document web app configuration and deployment
- [ ] Create troubleshooting guide
- [ ] Add architecture diagrams
- [ ] Add code comments and JSDoc

**Documentation Sections:**
- Prerequisites
- Installation & Setup
  - SSO Provider Configuration
  - io.Bridge Cluster Setup
  - Gateway Server Installation
  - Outlook Component Installation
  - Web App Deployment
- Configuration Reference
- Usage Guide
- Troubleshooting
- API Reference
- Architecture & Design Decisions

**Acceptance Criteria:**
- Documentation is complete and accurate
- New users can follow instructions successfully
- Common issues are documented

#### Task 5.3: Security Review
**Status:** ⏳ Not Started

**Description:** Review security aspects of the implementation.

**Review Areas:**
- [ ] Token storage security (Windows Credential Manager)
- [ ] Named pipe security (permissions, authentication)
- [ ] Gateway binding (localhost only, no external access)
- [ ] SSL/TLS configuration
- [ ] OAuth2 PKCE implementation
- [ ] Input validation (email parameters)
- [ ] CORS configuration
- [ ] Secrets management (client secrets, license keys)

**Acceptance Criteria:**
- No sensitive data in code or logs
- Proper authentication and authorization
- Network isolation enforced
- Security best practices followed

### Phase 6: Polish & Deployment

#### Task 6.1: Error Handling & User Experience
**Status:** ⏳ Not Started

**Description:** Improve error handling and user experience.

**Subtasks:**
- [ ] Add retry logic for transient failures
- [ ] Improve error messages (user-friendly)
- [ ] Add loading indicators
- [ ] Add connection status indicators
- [ ] Implement graceful degradation
- [ ] Add telemetry/logging (optional)

**Acceptance Criteria:**
- Users receive clear feedback
- System handles errors gracefully
- UX is polished and professional

#### Task 6.2: Example Repository Structure
**Status:** ⏳ Not Started

**Description:** Organize the example code in the repository.

**Structure:**
```
bridge-examples/
  outlook/
    readme.md (this file)
    bridge-local/
      package.json
      src/
        index.ts
      .env.example
      README.md
    gateway-server/
      package.json
      src/
        index.ts
        discovery.ts
        auth.ts
        config.ts
      .env.example
      README.md
    web-app/
      package.json
      src/
        App.tsx
        components/
          EmailForm.tsx
        config.ts
    docs/
      architecture.md
      setup-sso.md
      troubleshooting.md
    scripts/
      install-outlook.ps1
      setup-gateway.ps1
      start-all.ps1
```

**Acceptance Criteria:**
- Code is well-organized
- Easy to navigate
- Follows repository conventions

## Prerequisites

- Windows 10/11
- Microsoft Outlook (2016 or later)
- Node.js (v18 or later)
- io.Bridge license key
- (Optional) SSO provider account (Auth0 or similar) for authentication demo

**Note:** This example runs io.Bridge locally using the `@interopio/bridge` package. No cluster deployment is required.

## Quick Start

_(To be completed after implementation)_

## Configuration

### SSO Provider

_(To be completed based on chosen provider)_

### Gateway Server

_(To be completed)_

### Browser App

_(To be completed)_

## Troubleshooting

_(To be completed)_

## License

_(To be defined)_

## Contributing

_(To be defined)_
