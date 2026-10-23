# Local fork

Source: https://github.com/module-federation/tanstack
Commit: `fd1d6a0058e00de2d94e3751c4950c6b4d2c5b32`
Package version at import: 0.1.1

This directory preserves upstream source, license and dual ESM/CJS package exports. Local additions: Rsbuild `serverFunctions` option, remote SSR HTTP caller compilation, and optional host RPC gateway. No changes to Vite behavior. This is a local workspace fork, not a published npm package or a GitHub-network fork.

## Local changes

- Integrated `serverFunctions` support in the Rsbuild adapter.
- Added remote SSR caller compilation and HTTP transport, plus an optional host gateway.
- Preserved ESM/CJS entrypoints and declarations; added gateway exports.
- Used the prerelease workspace version `0.1.1-ssr-lab.1`.
- Updated the Vite build-tool dependency to the patched 8.3.5 release. Example applications still use Rsbuild/Rspack.
- Reformatted source with the repository's Biome configuration.

Vite source behavior is unchanged; the end-to-end tests here exercise Rsbuild hosts and remotes.
