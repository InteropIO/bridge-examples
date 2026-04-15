/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** License key for io.Connect Browser Platform (client-side) */
  readonly VITE_IO_CB_LICENSE_KEY: string;
  /** io.Bridge URL for browser platform connection */
  readonly VITE_IO_BRIDGE_URL: string;

  readonly VITE_AUTH0_DOMAIN: string;
  readonly VITE_AUTH0_CLIENT_ID: string;
  readonly VITE_AUTH0_AUDIENCE: string;
  readonly VITE_AUTH0_SCOPE: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
