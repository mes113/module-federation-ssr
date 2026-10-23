import test from "node:test";
import assert from "node:assert/strict";
import { withFederationGateway } from "@module-federation/tanstack/server-functions-gateway";
const gateway = withFederationGateway(
  { fetch: () => new Response("local") },
  { catalog: { origin: "http://127.0.0.1:1" } },
);

test("gateway rejects cross-origin, missing-origin and malformed-origin requests before upstream", async () => {
  for (const headers of [
    { origin: "https://evil.test" },
    {},
    { referer: "invalid" },
    { "sec-fetch-site": "cross-site" },
  ]) {
    const response = await gateway.fetch(
      new Request("http://localhost:3005/_federation/catalog/_serverFn/id", {
        method: "POST",
        headers,
      }),
    );
    assert.equal(response.status, 403);
  }
});
test("unknown namespace and local server functions remain with Start handler", async () => {
  for (const path of ["/_federation/unknown/_serverFn/id", "/_serverFn/id", "/"]) {
    const response = await gateway.fetch(new Request("http://localhost:3005" + path));
    assert.equal(await response.text(), "local");
  }
});
test("gateway refuses unsupported methods", async () => {
  const response = await gateway.fetch(
    new Request("http://localhost:3005/_federation/catalog/_serverFn/id", { method: "DELETE" }),
  );
  assert.equal(response.status, 405);
});
