/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** License key for io.Connect Browser Platform (client-side) */
  readonly VITE_IO_CB_LICENSE_KEY: string;
  /** io.Bridge URL for browser platform connection */
  readonly VITE_IO_CB_BRIDGE_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
