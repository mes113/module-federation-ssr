import { defineConfig } from "@rsbuild/core";
import { pluginReact } from "@rsbuild/plugin-react";
import { tanstackStart } from "@tanstack/react-start/plugin/rsbuild";
import { tanstackStartModuleFederation } from "@module-federation/tanstack/rsbuild";

const singleOrigin = process.env.SINGLE_ORIGIN === "1";
const publicOrigin = process.env.PUBLIC_ORIGIN || "http://127.0.0.1:3080";
const catalog = process.env.CATALOG_INTERNAL_ORIGIN || "http://127.0.0.1:3004";
const cart = process.env.CART_INTERNAL_ORIGIN || "http://127.0.0.1:3006";
const entries = {
  tanstack_rsbuild_ssr_remote: `tanstack_rsbuild_ssr_remote@${singleOrigin ? publicOrigin + "/_remotes/catalog" : catalog}/mf-manifest.json`,
  tanstack_rsbuild_cart: `tanstack_rsbuild_cart@${singleOrigin ? publicOrigin + "/_remotes/cart" : cart}/mf-manifest.json`,
};
export default defineConfig({
  source: {
    define: {
      "import.meta.env.LAB_SINGLE_ORIGIN": JSON.stringify(singleOrigin),
      "import.meta.env.LAB_PUBLIC_ORIGIN": JSON.stringify(publicOrigin),
    },
  },
  dev: { lazyCompilation: false },
  server: { host: "127.0.0.1", port: 3005 },
  plugins: [
    pluginReact(),
    tanstackStart(),
    ...tanstackStartModuleFederation({
      serverFunctions: singleOrigin
        ? undefined
        : {
            remotes: {
              catalog: { origin: "http://127.0.0.1:3004" },
              cart: { origin: "http://127.0.0.1:3006" },
            },
          },
      federation: {
        dts: {
          generateTypes: false,
          consumeTypes: {
            abortOnError: true,
            typesOnBuild: true,
            ...(process.env.MF_TYPES_ORIGIN
              ? {
                  remoteTypeUrls: {
                    tanstack_rsbuild_ssr_remote: {
                      alias: "tanstack_rsbuild_ssr_remote",
                      zip: `${process.env.MF_TYPES_ORIGIN}/catalog/@mf-types.zip`,
                      api: `${process.env.MF_TYPES_ORIGIN}/catalog/@mf-types.d.ts`,
                    },
                    tanstack_rsbuild_cart: {
                      alias: "tanstack_rsbuild_cart",
                      zip: `${process.env.MF_TYPES_ORIGIN}/cart/@mf-types.zip`,
                      api: `${process.env.MF_TYPES_ORIGIN}/cart/@mf-types.d.ts`,
                    },
                  },
                }
              : {}),
          },
        },
        name: "tanstack_rsbuild_ssr_host",
        // Workspace dependencies declare "workspace:*", which is not a semver range.
        shared: {
          "example-host-context": { requiredVersion: "*", singleton: true },
        },
        shareStrategy: "loaded-first",
        remotes: entries,
      },
      // Loads the Rsbuild remote on the server through its Node container.
      server: singleOrigin
        ? {
            dts: false,
            remotes: {
              tanstack_rsbuild_ssr_remote: `tanstack_rsbuild_ssr_remote@${catalog}/mf-manifest.json`,
              tanstack_rsbuild_cart: `tanstack_rsbuild_cart@${cart}/mf-manifest.json`,
            },
          }
        : { dts: false },
    }),
  ],
});
