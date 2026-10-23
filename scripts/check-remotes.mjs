// Own all processes so outage tests never stop a server started by the user.
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import assert from "node:assert/strict";
import { chromium } from "playwright";
const mode = process.argv[2] || "preview";
if (!["dev", "preview"].includes(mode)) throw new Error("Use dev or preview");
const children = new Set();
function start(app) {
  const child = spawn("npm", ["run", mode, "-w", `apps/${app}`], {
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
  });
  let log = "";
  child.stdout.on("data", (chunk) => {
    log = (log + chunk).slice(-12000);
  });
  child.stderr.on("data", (chunk) => {
    log = (log + chunk).slice(-12000);
  });
  child.logs = () => log;
  children.add(child);
  return child;
}
async function stop(child) {
  if (child.exitCode !== null || child.signalCode) {
    children.delete(child);
    return;
  }
  const exited = new Promise((resolve) => child.once("exit", resolve));
  process.kill(-child.pid, "SIGTERM");
  await exited;
  children.delete(child);
}
async function ready(port, text = "") {
  const deadline = Date.now() + 45000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/`, {
        signal: AbortSignal.timeout(2000),
      });
      if (response.ok && (await response.text()).includes(text)) return;
    } catch {}
    await delay(200);
  }
  throw new Error(`Server ${port} did not become ready`);
}
let browser;
try {
  // Refuse to run against any occupied test port, before starting a process.
  const { createServer } = await import("node:net");
  for (const port of [3004, 3005, 3006]) {
    await new Promise((resolve, reject) => {
      const server = createServer();
      server.once("error", reject);
      server.listen(port, "127.0.0.1", () => server.close(resolve));
    });
  }
  start("remote");
  let cart = start("remote-cart");
  await Promise.all([ready(3004), ready(3006)]);
  start("host");
  await ready(3005, 'data-remote="cart"');
  await new Promise((resolve, reject) => {
    const test = spawn("npm", ["test"], { stdio: "inherit" });
    test.once("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`Tests failed: ${code}`)),
    );
  });
  browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto("http://127.0.0.1:3005");
  for (const name of ["catalog", "cart"])
    await page
      .locator(`[data-remote="${name}"]`)
      .getByText("Hydrated on the host", { exact: true })
      .waitFor();
  await stop(cart);
  const failed = page.waitForResponse((r) => r.url().includes("/_federation/cart/_serverFn/"));
  await page
    .locator('[data-remote="cart"]')
    .getByRole("button", { name: "Call remote native server function", exact: true })
    .click();
  assert.equal((await failed).status(), 502);
  const success = page.waitForResponse((r) => r.url().includes("/_federation/catalog/_serverFn/"));
  await page
    .locator('[data-remote="catalog"]')
    .getByRole("button", { name: "Call remote native server function", exact: true })
    .click();
  assert.equal((await success).status(), 200);
  const html = await fetch("http://127.0.0.1:3005").then((r) => {
    assert.equal(r.status, 200);
    return r.text();
  });
  assert.match(html, /Cart backend unavailable/);
  assert.match(html, /data-remote="catalog"/);
  await page.reload();
  await page.getByTestId("cart-unavailable").waitFor();
  await page
    .locator('[data-remote="catalog"]')
    .getByText("Hydrated on the host", { exact: true })
    .waitFor();
  console.log("PASS: cart offline → cart RPC 502; catalog RPC 200; host SSR and hydration survive");
  cart = start("remote-cart");
  await ready(3006);
  await page.reload();
  await page
    .locator('[data-remote="cart"]')
    .getByText("Hydrated on the host", { exact: true })
    .waitFor();
  const recovered = page.waitForResponse((r) => r.url().includes("/_federation/cart/_serverFn/"));
  await page
    .locator('[data-remote="cart"]')
    .getByRole("button", { name: "Call remote native server function", exact: true })
    .click();
  assert.equal((await recovered).status(), 200);
  console.log("PASS: cart restarted → SSR, hydration and cart RPC recover without host restart");
} catch (error) {
  for (const child of children) console.error(child.logs());
  throw error;
} finally {
  if (browser) await browser.close();
  await Promise.all([...children].map(stop));
}
