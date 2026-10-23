# TanStack Start SSR Federation Lab — Rsbuild / Rspack

Experimental reproduction and implementation for upstream review. This repository adds remote server-function transport to the Rsbuild adapter while preserving federated SSR and generated TypeScript declarations. It is not an official Module Federation release.

## For upstream reviewers

The original component SSR flow works, but a remote `createServerFn` called in the host browser targets the host function registry and fails with `Server function info not found`. The fork gives each remote a namespace and backend transport, and compiles remote SSR callers without publishing backend handlers.
- [New Rsbuild option and registration](packages/tanstack/src/rsbuild.ts)
- [Start compiler bridge and SSR HTTP transport](packages/tanstack/src/server-functions.ts)
- [Optional host RPC gateway](packages/tanstack/src/server-functions-gateway.ts)
- [API, compatibility constraints, and transport limitations](packages/tanstack/SERVER_FUNCTIONS.md)
- [Pinned upstream revision](packages/tanstack/UPSTREAM.md)

The compiler bridge currently depends on private Start plugin core APIs pinned to `1.171.52`. The examples verify two remotes, SSR, hydration, DTS, parallel RPC, and backend recovery. CI runs both host-gateway and local single-origin modes.

Three independent TanStack Start applications using Rsbuild/Rspack and a local fork of `@module-federation/tanstack`.

| Application      | Address               | Role                                                   |
| ---------------- | --------------------- | ------------------------------------------------------ |
| Host             | http://127.0.0.1:3005 | Renders both remotes and exposes host server functions |
| Catalog          | http://127.0.0.1:3004 | Exposes a component and its own server function        |
| Cart             | http://127.0.0.1:3006 | A second independent remote and backend                |
| Local edge proxy | http://127.0.0.1:3080 | Optional single-origin entry point                     |

Use Node 22.18+, 24.11+, or 26+. The applications use Rsbuild; the fork retains upstream Vite exports for compatibility.

## Setup and development

```sh
npm ci
npx playwright install chromium
npm run build
npm run dev
```

The initial build generates and downloads remote declarations. `npm run dev` rebuilds the fork before starting the three development servers. In another terminal:

```sh
npm test
npm run typecheck
```

The tests expect all three application servers to be running. Do not run development, preview, or single-origin servers on the same ports simultaneously.

## Production preview

Stop development servers, then run:

```sh
npm run build
npm run preview
```

Run `npm test` in another terminal. The production build compiles the fork, both remotes, and the host in that order.

## Local fork and server functions

[packages/tanstack](packages/tanstack) is the local workspace fork, version `0.1.1-ssr-lab.1`. Applications import it under the original package name. Its Rsbuild adapter exposes a `serverFunctions` option; no separate plugin is required.

In the standard mode, browser calls to remote functions use a namespaced host gateway. During SSR, remote function calls go directly to their backend. The Start compiler replaces backend handlers with HTTP caller stubs in the public federation SSR output.

See [serverFunctions API and limitations](packages/tanstack/SERVER_FUNCTIONS.md). The integration uses a private Start compiler API pinned to version `1.171.52`. Authentication, sessions, middleware context forwarding, and custom serialization adapters require further integration. The POST demo returns a transformed value and has no persistent storage.

Without this integration, a remote function called inside the host sends its RPC to the host's function registry and fails with `Server function info not found`.

## What the tests cover

- Remote markup and CSS in the host's initial streaming HTML, including concurrent requests.
- Hydration, interactive counters, and shared React context.
- Host GET server functions in SSR loaders and host POST functions called from remote components.
- Remote server functions through the host gateway and directly in the standalone catalog app.
- SSR and browser calls to both backends, with distinct process IDs and isolated namespaces.
- Absence of backend handler implementations in public browser and federation SSR assets.
- Gateway origin checks and routing of unknown namespaces to the normal Start handler.
- Workspace fork resolution, ESM/CJS exports, and configuration validation.

## Multiple remotes and backend recovery

With ports 3004, 3005, and 3006 free:

```sh
npm run build
npm run test:remotes
npm run test:remotes:dev
```

These commands own their test processes and shut them down afterward. They run the integration suite, stop only cart, and verify that cart RPC returns 502 while catalog RPC returns 200. Host SSR and hydration continue with `Cart backend unavailable`. Restarting cart restores SSR and RPC without restarting the host.

The outage scenario runs after the host has loaded the remotes. Cold host startup with an unavailable remote is not covered. Chromium also checks three pairs of concurrent browser RPCs. In the current production build, both functions have the same ID; their namespaces keep the requests separate.

## Single-origin mode

The optional local reverse proxy routes browser requests to the matching backend, bypassing host Node for remote assets and RPC. Host SSR uses internal backend addresses.

| Public path                        | Backend            | Path handling             |
| ---------------------------------- | ------------------ | ------------------------- |
| `/`, host assets, `/_serverFn/*`   | Host, port 3005    | Unchanged                 |
| `/_remotes/catalog/*`              | Catalog, port 3004 | Strip `/_remotes/catalog` |
| `/_remotes/cart/*`                 | Cart, port 3006    | Strip `/_remotes/cart`    |
| `/_federation/catalog/_serverFn/*` | Catalog, port 3004 | Unchanged                 |
| `/_federation/cart/_serverFn/*`    | Cart, port 3006    | Unchanged                 |

Stop other servers first:

```sh
npm run build:edge
npm run start:edge
# In another terminal:
npm run test:edge
```

Open http://127.0.0.1:3080. The test checks SSR, hydration, RPC ownership, DTS archive reachability, and that every browser request uses this origin. Diagnostic `x-lab-app` response headers identify which backend served each request.

Both modes write to the same `dist` directories. Rebuild when switching between standard and single-origin modes.

`PUBLIC_ORIGIN` selects the public address at build time. `CATALOG_INTERNAL_ORIGIN` and `CART_INTERNAL_ORIGIN` select host SSR federation addresses at build time and remote SSR RPC addresses at runtime. Keep build-time and runtime addresses consistent. The defaults use the local addresses in the application table.

The local production Node runner preserves the public scheme when its configured `PUBLIC_ORIGIN` matches the incoming Host. The reverse proxy must preserve that Host for Start's same-origin checks.

## DTS: generated remote declarations

Both remotes enable `dts.generateTypes` with `abortOnError: true`, producing `@mf-types.zip` and `@mf-types.d.ts`. The host enables `dts.consumeTypes` with `typesOnBuild: true` and strict error handling.

The build starts a temporary loopback artifact server after compiling the remotes. The official DTS consumer downloads their fresh declarations before the host build. Application backends do not need to be running. `MF_TYPES_ORIGIN` is set by the build script solely for declaration downloads; it does not change application endpoints.

Downloaded declarations live in `apps/host/@mf-types` and are excluded from Git. TypeScript resolves remote imports through `paths` mappings. There are no handwritten remote module shims. Compile-time checks in `remote-types.check.ts` verify literal return types and reject invalid component props.

On a clean checkout, run a complete build before `npm run typecheck`. During development, without `MF_TYPES_ORIGIN`, the host downloads declarations from the configured remote manifest addresses, so the remotes must be available.

In single-origin mode, declarations are also served at `/_remotes/catalog/@mf-types.zip` and `/_remotes/cart/@mf-types.zip`. The remote client build owns these artifacts; the federation SSR build does not generate a separate set.

## Formatting

Biome 2.6.2 formats JavaScript, TypeScript, JSX/TSX, JSON, and CSS across the applications, fork, scripts, and tests.

```sh
npm run format        # Apply formatting
npm run format:check  # Verify formatting without changing files
```

The shared configuration uses two spaces, double quotes, semicolons, and a 100-character line width. Generated route trees, downloaded declarations, build output, dependencies, and the npm lockfile are excluded. Linting and import organization are disabled; these commands only format code.

## Package build and provenance

`npm run build:fork` builds only the fork using Rslib, emitting ESM, CJS, and TypeScript declarations. Full builds include this step automatically. `npm run typecheck` checks both application code and fork source.

See [UPSTREAM.md](packages/tanstack/UPSTREAM.md) for the pinned upstream commit and local changes. The fork is vendored inside this repository; it is not an npm release or a GitHub-network fork of the upstream repository. The repository uses the [MIT license](LICENSE). Original notices are preserved in [LICENSE.upstream](LICENSE.upstream) and the package license.

## Key files

- `packages/tanstack/src/rsbuild.ts`: federation configuration and the integrated `serverFunctions` option.
- `packages/tanstack/src/server-functions.ts`: remote SSR compiler bridge and optional host gateway registration.
- `packages/tanstack/src/server-functions-gateway.ts`: host HTTP gateway.
- `apps/host/src/routes/index.tsx`: parallel SSR loading, stylesheet links, and remote fallbacks.
- `apps/host/src/federation.ts`: public and internal manifest/style addresses.
- `apps/host/src/probe.functions.ts`: host GET and POST functions.
- `apps/remote/src/probe.functions.ts` and `apps/remote-cart/src/probe.functions.ts`: independent remote functions.
- `scripts/build.mjs`: package/application build order and temporary DTS artifact server.
- `scripts/check-remotes.mjs`: isolated multi-remote and outage checks.
- `scripts/edge-server.mjs` and `scripts/node-server.mjs`: optional local single-origin runtime.

## References

- [Module Federation TanStack integration](https://github.com/module-federation/tanstack)
- [TanStack Start server functions](https://tanstack.com/start/latest/docs/framework/react/guide/server-functions)
- [Module Federation DTS configuration](https://module-federation.io/configure/dts)
