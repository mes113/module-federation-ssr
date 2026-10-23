// Local path-based reverse proxy: remote traffic bypasses host Node.
import { createServer, request } from "node:http";
const routes = {
  catalog: process.env.CATALOG_INTERNAL_ORIGIN || "http://127.0.0.1:3004",
  cart: process.env.CART_INTERNAL_ORIGIN || "http://127.0.0.1:3006",
};
createServer((req, res) => {
  const url = new URL(req.url, "http://edge");
  const assets = url.pathname.match(/^\/_remotes\/(catalog|cart)\/(.*)$/);
  const rpc = url.pathname.match(/^\/_federation\/(catalog|cart)\/_serverFn\//);
  const name = assets?.[1] || rpc?.[1];
  const upstream = new URL(
    name ? routes[name] : process.env.HOST_INTERNAL_ORIGIN || "http://127.0.0.1:3005",
  );
  const path = (assets ? "/" + assets[2] : url.pathname) + url.search;
  const proxy = request(
    upstream,
    { method: req.method, path, headers: req.headers },
    (incoming) => {
      res.writeHead(incoming.statusCode, { ...incoming.headers, "x-lab-route": name || "host" });
      incoming.pipe(res);
    },
  );
  proxy.on("error", () => {
    if (!res.headersSent) res.writeHead(502);
    res.end("Upstream unavailable");
  });
  req.on("aborted", () => proxy.destroy());
  req.pipe(proxy);
}).listen(Number(process.env.EDGE_PORT || 3080), "127.0.0.1", () =>
  console.log("Edge on http://127.0.0.1:3080"),
);
