// Build remotes first, then let the official DTS consumer fetch their fresh artifacts.
// No running application backends are required to fetch build-time declarations.
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
const run = (app, env = process.env) =>
  new Promise((resolve, reject) => {
    const child = spawn("npm", ["run", "build", "-w", `apps/${app}`], { env, stdio: "inherit" });
    child.once("error", reject);
    child.once("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`${app} build failed (${code})`)),
    );
  });
await new Promise((resolve, reject) => {
  const child = spawn("npm", ["run", "build:fork"], { stdio: "inherit" });
  child.once("error", reject);
  child.once("exit", (code) => (code === 0 ? resolve() : reject(new Error("Fork build failed"))));
});
await run("remote");
await run("remote-cart");
const apps = { catalog: "remote", cart: "remote-cart" };
const server = createServer(async (req, res) => {
  const match = req.url.match(/^\/(catalog|cart)\/(@mf-types\.(?:zip|d\.ts))$/);
  if (!match) {
    res.writeHead(404).end();
    return;
  }
  try {
    res.setHeader("content-type", match[2].endsWith(".zip") ? "application/zip" : "text/plain");
    res.end(await readFile(`apps/${apps[match[1]]}/dist/client/${match[2]}`));
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((resolve, reject) => {
  server.once("error", reject);
  server.listen(0, "127.0.0.1", resolve);
});
try {
  await run("host", {
    ...process.env,
    MF_TYPES_ORIGIN: `http://127.0.0.1:${server.address().port}`,
  });
} finally {
  await new Promise((resolve) => server.close(resolve));
}
