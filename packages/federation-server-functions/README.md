# Federation server functions (prototype)

Rsbuild plugin on top of `@module-federation/tanstack/rsbuild`. No patches to installed dependencies.

```ts
// remote rsbuild.config.ts
import { federationServerFunctions } from './path/to/rsbuild.mjs';
plugins: [
  pluginReact(),
  tanstackStart({ serverFns: { base: '/_federation/catalog/_serverFn' } }),
  ...tanstackStartModuleFederation({ federation: { /* name, exposes */ }, server: true }),
  federationServerFunctions({ remote: { name: 'catalog', origin: 'http://127.0.0.1:3004' } }),
]

// host: after tanstackStart() and the existing federation adapter
federationServerFunctions({
  remotes: {
    catalog: { origin: 'http://127.0.0.1:3004' },
    cart: { origin: 'http://127.0.0.1:3006' },
  },
})
```

The remote's Start `serverFns.base` must match `/_federation/<name>/_serverFn`. The remote origin must be reachable by the host Node process. The remote still runs its own Start backend; serving only its static assets is insufficient.

Browser stubs use the namespaced relative URL. The host plugin wraps the built Start server entry, so the gateway runs in development, preview and a deployment that imports that entry. Standalone remote requests are handled directly by remote Start at the same namespaced path.

For `mf-server`, the plugin registers Start's own compiler with a server caller environment and aliases its generated `ssr-rpc` import to an HTTP transport. The handler implementation stays in the remote's private server output. The wrapper reuses Start's serializer and RPC metadata.

## Compatibility

Tested with `@module-federation/tanstack` 0.1.1, React Start 1.169.1, Start plugin core **1.171.52**, Rsbuild 2.2.11 and React 19.3.0. The plugin deliberately fails on a different compiler version. It imports the private `registerStartCompilerTransforms` module, because there is no public hook for adding this environment. The current implementation expects Start's single SSR entry and the adapter's default `mf-server` name. Custom compiler extensions, custom function ID generators and custom environment names are not yet integrated.

## Transport limits

- This is a prototype for standard Start RPC serialization, not a full authentication/session integration.
- Browser gateway checks same-origin signals before translating Origin for the upstream hop. Only configured namespaces are accepted; caller URLs cannot select the upstream.
- Cookies, Authorization and Set-Cookie are excluded by default. `forwardCredentials: true` enables passthrough for a trusted upstream; cookie domain/path rewriting is not implemented.
- SSR calls do not forward host request cookies, auth headers or middleware context. Backend middleware still executes on the remote.
- SSR calls go directly to the remote backend; browser calls use the host gateway. Host Start request middleware does not wrap gateway requests, so host authentication must be integrated explicitly before production use.
- Gateway preserves raw responses and streams, uses manual redirects and a 10-second timeout. Redirect mapping between public and upstream origins, custom serialization adapters, abort behavior and streaming RPC have not yet been validated end-to-end.
- Gateway validates against the incoming Request origin. Reverse proxies must provide the correct public URL.
- `remote.origin` is compiled into the Node container. Runtime-configurable backend discovery remains future work.

Run `npm pack --dry-run` from this directory to inspect a distributable package. The package has not been published.

## Multiple remotes

Use a unique namespace for each backend. The host uses one plugin instance with multiple `remotes` entries; each remote uses its own `remote.name` and matching Start `serverFns.base`. Module Federation module names are configured separately in the existing federation adapter. The lab includes catalog (:3004) and cart (:3006), both rendered by host (:3005). Run `npm run test:remotes` / `npm run test:remotes:dev` from the repository root with all three ports free to verify concurrent RPC, outage isolation and recovery.
