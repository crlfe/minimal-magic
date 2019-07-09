/* Add missing url property to import.meta. */
declare interface ImportMeta {
  url: string;
}

/* Minimal declarations because live-server does not publish types. */
declare module "live-server" {
  interface StartOptions {
    root?: string;
    host?: string;
    port?: number;
    mount?: Array<[string, string]>;
  }

  function start(options: StartOptions): void;
}
