# Federation server functions (prototype)

Integrated into this local fork's Rsbuild adapter. No second plugin and no patches to installed dependencies.

```ts
import { tanstackStartModuleFederation } from '@module-federation/tanstack/rsbuild';

// Remote: after pluginReact() and tanstackStart({ serverFns: { base: '/_federation/catalog/_serverFn' } })
...tanstackStartModuleFederation({
  federation: { name: 'catalog_app', exposes: { './Card': './src/Card.tsx' } },
  server: true,
  serverFunctions: {
    remote: { name: 'catalog', origin: 'http://127.0.0.1:3004', originEnv: 'CATALOG_INTERNAL_ORIGIN' },
  },
})

// Host with application-level RPC gateway:
...tanstackStartModuleFederation({
  federation: {
    name: 'host', shareStrategy: 'loaded-first',
    remotes: { catalog_app: 'catalog_app@http://127.0.0.1:3004/mf-manifest.json' },
  },
  server: true,
  serverFunctions: { remotes: { catalog: { origin: 'http://127.0.0.1:3004' } } },
})
```

For a host behind an edge gateway that routes remote RPC directly to remote backends, omit `serverFunctions` on the host. Keep `serverFunctions.remote` on each remote: SSR still needs the HTTP caller compiler bridge.

The remote's Start `serverFns.base` must match `/_federation/<name>/_serverFn`. The remote origin must be reachable by the host Node process. The remote still runs its own Start backend; serving only its static assets is insufficient.

Browser stubs use the namespaced relative URL. The host plugin wraps the built Start server entry, so the gateway runs in development, preview and a deployment that imports that entry. Standalone remote requests are handled directly by remote Start at the same namespaced path.

For `mf-server`, the plugin registers Start's own compiler with a server caller environment and aliases its generated `ssr-rpc` import to an HTTP transport. The handler implementation stays in the remote's private server output. The wrapper reuses Start's serializer and RPC metadata.

## Compatibility

Tested with `@module-federation/tanstack` 0.1.1-ssr-lab.1 (upstream 0.1.1), React Start 1.169.1, Start plugin core **1.171.52**, Rsbuild 2.2.11 and React 19.3.0. The plugin deliberately fails on a different compiler version. It imports the private `registerStartCompilerTransforms` module, because there is no public hook for adding this environment. The current implementation expects Start's single SSR entry; the adapter forwards its selected server/container environment names to the compiler bridge. Custom compiler extensions, custom function ID generators and custom environment names are not yet integrated.

## Transport limits

- This is a prototype for standard Start RPC serialization, not a full authentication/session integration.
- Browser gateway checks same-origin signals before translating Origin for the upstream hop. Only configured namespaces are accepted; caller URLs cannot select the upstream.
- Cookies, Authorization and Set-Cookie are excluded by default. `forwardCredentials: true` enables passthrough for a trusted upstream; cookie domain/path rewriting is not implemented.
- SSR calls do not forward host request cookies, auth headers or middleware context. Backend middleware still executes on the remote.
- SSR calls go directly to the remote backend; browser calls use the host gateway. Host Start request middleware does not wrap gateway requests, so host authentication must be integrated explicitly before production use.
- Gateway preserves raw responses and streams, uses manual redirects and a 10-second timeout. Redirect mapping between public and upstream origins, custom serialization adapters, abort behavior and streaming RPC have not yet been validated end-to-end.
- Gateway validates against the incoming Request origin. Reverse proxies must provide the correct public URL.
- `remote.origin` is the compiled fallback. When `remote.originEnv` is set, the Node container reads that runtime environment variable first.

Run `npm pack --dry-run` from this directory to inspect a distributable package. The package has not been published.

## Multiple remotes

Use a unique namespace for each backend. The host uses one adapter call with multiple `serverFunctions.remotes` entries; each remote uses its own `serverFunctions.remote.name` and matching Start `serverFns.base`. Module Federation module names are configured separately in the existing federation adapter. The lab includes catalog (:3004) and cart (:3006), both rendered by host (:3005). Run `npm run test:remotes` / `npm run test:remotes:dev` from the repository root with all three ports free to verify concurrent RPC, outage isolation and recovery.
