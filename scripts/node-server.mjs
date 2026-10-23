import { createServer } from "node:http";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { readFile, stat } from "node:fs/promises";
import { resolve, sep, extname } from "node:path";
import { pathToFileURL } from "node:url";
process.env.NODE_ENV ||= "production";
const app = process.env.APP || process.argv[2];
if (!["host", "remote", "remote-cart"].includes(app)) throw new Error("Unknown APP");
const port = Number(process.env.PORT || { host: 3005, remote: 3004, "remote-cart": 3006 }[app]);
const root = resolve(`apps/${app}/dist/client`);
const { default: entry } = await import(pathToFileURL(resolve(`apps/${app}/dist/server/index.js`)));
const mime = {
  ".js": "text/javascript",
  ".cjs": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
};
const server = createServer(async (req, res) => {
  res.setHeader("x-lab-app", app);
  try {
    const publicOrigin = process.env.PUBLIC_ORIGIN ? new URL(process.env.PUBLIC_ORIGIN) : null;
    const scheme = publicOrigin?.host === req.headers.host ? publicOrigin.protocol : "http:";
    const url = new URL(req.url, `${scheme}//${req.headers.host}`);
    if (url.pathname === "/healthz") {
      res.end("ok");
      return;
    }
    const file = resolve(root, "." + decodeURIComponent(url.pathname));
    if (file.startsWith(root + sep) && ["GET", "HEAD"].includes(req.method)) {
      try {
        if ((await stat(file)).isFile()) {
          res.setHeader("content-type", mime[extname(file)] || "application/octet-stream");
          res.end(req.method === "HEAD" ? undefined : await readFile(file));
          return;
        }
      } catch (error) {
        if (!["ENOENT", "ENOTDIR"].includes(error.code)) throw error;
      }
    }
    const request = new Request(url, {
      method: req.method,
      headers: req.headers,
      body: ["GET", "HEAD"].includes(req.method) ? undefined : Readable.toWeb(req),
      duplex: "half",
    });
    const response = await entry.fetch(request);
    res.statusCode = response.status;
    for (const [key, value] of response.headers)
      if (key !== "set-cookie") res.setHeader(key, value);
    if (response.headers.getSetCookie().length)
      res.setHeader("set-cookie", response.headers.getSetCookie());
    if (response.body && req.method !== "HEAD")
      await pipeline(Readable.fromWeb(response.body), res);
    else res.end();
  } catch (error) {
    console.error(error);
    if (!res.headersSent) res.writeHead(500);
    res.end("Server error");
  }
});
server.listen(port, "0.0.0.0", () => console.log(`${app} listening on ${port}`));
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => server.close(() => process.exit()));
