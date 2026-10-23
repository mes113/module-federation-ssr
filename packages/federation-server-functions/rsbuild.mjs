import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { mkdirSync, writeFileSync } from 'node:fs';

/** Prototype: internal compiler integration is pinned to start-plugin-core 1.171.52. */
export function federationServerFunctions({ remote, remotes } = {}) {
  return {
    name: 'federation-server-functions',
    async setup(api) {
      const root = api.context.rootPath;
      const cache = join(root, 'node_modules/.cache/federation-server-functions');
      mkdirSync(cache, { recursive: true });
      if (remote) {
        if (!/^[a-zA-Z0-9_-]+$/.test(remote.name)) throw new Error('Invalid remote name');
        if (!/^https?:$/.test(new URL(remote.origin).protocol)) throw new Error('Invalid remote origin');
        const require = createRequire(join(root, 'package.json'));
        const pkg = require.resolve('@tanstack/start-plugin-core/package.json');
        if (require(pkg).version !== '1.171.52') throw new Error('Unsupported Start compiler version');
        // Reuse the actual Start compiler, including dev ID encoding. Never regex-strip handlers.
        const { registerStartCompilerTransforms } = await import(pathToFileURL(join(dirname(pkg), 'dist/esm/rsbuild/start-compiler-host.js')).href);
        registerStartCompilerTransforms(api, {
          root, framework: 'react', environments: [{ name: 'mf-server', type: 'server' }], providerEnvName: 'ssr',
        });
        const stub = join(cache, 'rpc.mjs');
        writeFileSync(stub, `import { createClientRpc as original } from '@tanstack/start-client-core/client-rpc';
export function createSsrRpc(id) {
  const rpc = original(id);
  const wrapped = (...args) => {
    const opts = args[0] ?? {};
    return rpc({ ...opts, fetch: (url, init) => {
      const target = new URL(url, ${JSON.stringify(remote.origin)});
      const headers = new Headers(init.headers);
      headers.set('origin', target.origin);
      return fetch(target, { ...init, headers, signal: init.signal ?? AbortSignal.timeout(10000) });
    }});
  };
  return Object.assign(wrapped, rpc);
}`);
        api.modifyEnvironmentConfig((config, { name }) => {
          if (name === 'mf-server') {
            config.resolve.alias['@tanstack/react-start/ssr-rpc$'] = stub;
          }
        });
        // Browser and SSR stubs use the same namespaced path; remote Start must handle it.
      }
      if (remotes) {
        for (const [name, config] of Object.entries(remotes)) {
          if (!/^[a-zA-Z0-9_-]+$/.test(name) || !/^https?:$/.test(new URL(config.origin).protocol)) throw new Error('Invalid gateway target');
        }
        api.modifyRspackConfig((config, { environment, rspack }) => {
          if (environment.name !== 'ssr') return;
          const entry = config.entry.index;
          if (!entry || typeof entry !== 'object' || !Array.isArray(entry.import) || entry.import.length !== 1) throw new Error('Unsupported Start server entry');
          const original = entry.import[0];
          const wrapper = join(cache, 'server.mjs');
          const gateway = fileURLToPath(new URL('./gateway.mjs', import.meta.url));
          config.plugins.push(new rspack.experiments.VirtualModulesPlugin({ [wrapper]: `
import entry from ${JSON.stringify(original)};
import { withFederationGateway } from ${JSON.stringify(gateway)};
export * from ${JSON.stringify(original)};
export default withFederationGateway(entry, ${JSON.stringify(remotes)});
` }));
          entry.import = [wrapper];
        });
      }
    },
  };
}
