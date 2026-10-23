// Run against npm run start:edge; all browser traffic must use the public origin.
import assert from "node:assert/strict";
import { chromium } from "playwright";
const origin = process.env.PUBLIC_ORIGIN || "http://127.0.0.1:3080";
const htmlResponse = await fetch(origin);
assert.equal(htmlResponse.headers.get("x-lab-app"), "host");
assert.equal(htmlResponse.status, 200);
const html = await htmlResponse.text();
for (const name of ["catalog", "cart"]) {
  assert.ok(html.includes(`data-remote="${name}"`));
  assert.ok(html.includes(`${origin}/_remotes/${name}/assets/`));
}
assert.ok(!/https?:\/\/127\.0\.0\.1:300[46]/.test(html), "Private remote URLs leaked into HTML");
for (const name of ["catalog", "cart"]) {
  const types = await fetch(`${origin}/_remotes/${name}/@mf-types.zip`);
  assert.equal(types.status, 200);
  const bytes = new Uint8Array(await types.arrayBuffer());
  assert.equal(
    String.fromCharCode(...bytes.slice(0, 2)),
    "PK",
    "Remote DTS archive must be served through gateway",
  );
}
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  const requests = [],
    errors = [],
    responses = [];
  page.on("request", (request) => requests.push(request.url()));
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("response", (response) => responses.push(response));
  await page.goto(origin);
  for (const [name, app, owner] of [
    ["catalog", "remote", "remote"],
    ["cart", "remote-cart", "cart"],
  ]) {
    const card = page.locator(`[data-remote="${name}"]`);
    await card.getByText("Hydrated on the host", { exact: true }).waitFor();
    const pending = page.waitForResponse((r) =>
      r.url().includes(`/_federation/${name}/_serverFn/`),
    );
    await card
      .getByRole("button", { name: "Call remote native server function", exact: true })
      .click();
    const response = await pending;
    assert.equal(response.status(), 200);
    assert.equal(response.headers()["x-lab-app"], app, "RPC must bypass host Node");
    if (response.headers()["x-lab-route"]) assert.equal(response.headers()["x-lab-route"], name);
    await page.waitForFunction(
      (name) =>
        document
          .querySelector(`[data-remote="${name}"] [data-testid="remote-rpc"]`)
          .textContent.includes('"owner"'),
      name,
    );
    assert.equal(JSON.parse(await card.getByTestId("remote-rpc").innerText()).owner, owner);
    const ssr = await page.getByTestId(`${name}-ssr`).innerText();
    const pids = ssr.match(/pid (\d+).*host pid (\d+)/);
    assert.ok(pids);
    assert.notEqual(pids[1], pids[2]);
  }
  const callback = page.waitForResponse(
    (r) => r.url().includes("/_serverFn/") && !r.url().includes("/_federation/"),
  );
  await page
    .locator('[data-remote="catalog"]')
    .getByRole("button", { name: "Call host server function", exact: true })
    .click();
  assert.equal((await callback).headers()["x-lab-app"], "host");
  for (const url of requests)
    assert.equal(new URL(url).origin, origin, `Browser bypassed edge: ${url}`);
  for (const response of responses)
    assert.ok(response.status() < 400, `${response.status()} ${response.url()}`);
  for (const name of ["catalog", "cart"]) {
    assert.ok(requests.some((url) => url.includes(`/_remotes/${name}/mf-manifest.json`)));
    assert.ok(requests.some((url) => url.includes(`/_remotes/${name}/`) && /\.js/.test(url)));
  }
  assert.deepEqual(errors, []);
  console.log(
    `PASS: SSR + hydration + both RPC backends; all ${requests.length} browser requests use ${origin}; remote RPC bypasses host Node`,
  );
} finally {
  await browser.close();
}
