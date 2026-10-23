import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { realpathSync } from "node:fs";
import { tanstackStartModuleFederation } from "@module-federation/tanstack/rsbuild";
const require = createRequire(import.meta.url);

test("ESM and CJS consumers resolve the workspace fork with typed serverFunctions support", () => {
  assert.match(
    realpathSync(require.resolve("@module-federation/tanstack/package.json")),
    /packages\/tanstack\/package.json$/,
  );
  const cjs = require("@module-federation/tanstack/rsbuild");
  assert.equal(typeof cjs.tanstackStartModuleFederation, "function");
  for (const plugin of [tanstackStartModuleFederation, cjs.tanstackStartModuleFederation]) {
    assert.throws(
      () => plugin({ federation: { name: "test", dts: false }, serverFunctions: {} }),
      /requires server/,
    );
    assert.throws(
      () =>
        plugin({
          federation: { name: "test", dts: false },
          server: true,
          serverFunctions: { remote: { name: "catalog", origin: "http://localhost:3004" } },
        }),
      /requires federation.exposes/,
    );
    assert.throws(
      () =>
        plugin({
          federation: { name: "test", dts: false },
          server: true,
          serverFunctions: { remotes: { catalog: { origin: "http://localhost:3004" } } },
        }),
      /requires federation.remotes/,
    );
  }
});
