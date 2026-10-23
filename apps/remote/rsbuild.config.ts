import { defineConfig } from "@rsbuild/core";
import { pluginReact } from "@rsbuild/plugin-react";
import { tanstackStart } from "@tanstack/react-start/plugin/rsbuild";
import { tanstackStartModuleFederation } from "@module-federation/tanstack/rsbuild";

export default defineConfig({
  dev: { lazyCompilation: false },
  server: {
    cors: { origin: ["http://127.0.0.1:3000", "http://127.0.0.1:3005"] },
    host: "127.0.0.1",
    port: 3004,
  },
  plugins: [
    pluginReact(),
    tanstackStart({ serverFns: { base: "/_federation/catalog/_serverFn" } }),
    ...tanstackStartModuleFederation({
      serverFunctions: {
        remote: {
          name: "catalog",
          originEnv: "CATALOG_INTERNAL_ORIGIN",
          origin: "http://127.0.0.1:3004",
        },
      },
      federation: {
        dev: { disableDynamicRemoteTypeHints: true },
        dts: { generateTypes: { abortOnError: true }, consumeTypes: false },
        exposes: {
          "./StatusCard": "./src/components/StatusCard.tsx",
          "./probe": "./src/probe.functions.ts",
        },
        name: "tanstack_rsbuild_ssr_remote",
        // Workspace dependencies declare "workspace:*", which is not a semver range.
        shared: { "example-host-context": { requiredVersion: "*", singleton: true } },
      },
      // Builds an async-node server container next to the browser container, so an
      // Rsbuild host can render this card on the server.
      server: true,
    }),
  ],
});
