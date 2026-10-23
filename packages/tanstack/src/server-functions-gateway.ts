export interface GatewayTarget {
  origin: string;
  forwardCredentials?: boolean;
}
export type GatewayEntry = {
  fetch: (request: Request, ...args: any[]) => Response | Promise<Response>;
};
/** Wrap a Start fetch handler. Only configured namespaces can reach an upstream. */
export function withFederationGateway<T extends GatewayEntry>(
  entry: T,
  remotes: Record<string, GatewayTarget>,
) {
  return {
    ...entry,
    async fetch(request: Request, ...args: any[]) {
      const url = new URL(request.url);
      const match = Object.entries(remotes).find(([name]) =>
        url.pathname.startsWith(`/_federation/${name}/_serverFn/`),
      );
      if (!match) return entry.fetch(request, ...args);
      if (!["GET", "POST"].includes(request.method))
        return new Response("Method not allowed", { status: 405 });
      // Validate the public request before replacing its Origin for the private hop.
      const origin = request.headers.get("origin");
      const referer = request.headers.get("referer");
      const site = request.headers.get("sec-fetch-site");
      let refererOrigin;
      try {
        refererOrigin = referer ? new URL(referer).origin : undefined;
      } catch {
        return new Response("Forbidden", { status: 403 });
      }
      if (
        (origin && origin !== url.origin) ||
        (site && site !== "same-origin") ||
        (!origin && !site && refererOrigin !== url.origin)
      ) {
        return new Response("Forbidden", { status: 403 });
      }
      const [, config] = match;
      const target = new URL(url.pathname + url.search, config.origin);
      const headers = new Headers();
      for (const key of ["accept", "content-type", "x-tsr-serverfn"]) {
        const value = request.headers.get(key);
        if (value) headers.set(key, value);
      }
      if (config.forwardCredentials)
        for (const key of ["cookie", "authorization"]) {
          const value = request.headers.get(key);
          if (value) headers.set(key, value);
        }
      headers.set("origin", target.origin);
      try {
        const init: RequestInit & { duplex: "half" } = {
          method: request.method,
          headers,
          redirect: "manual",
          body: request.method === "POST" ? request.body : undefined,
          duplex: "half",
          signal: AbortSignal.any([request.signal, AbortSignal.timeout(10_000)]),
        };
        const response = await fetch(target, init);
        const outgoing = new Headers(response.headers);
        // Fetch may decompress the upstream body; don't retain stale transfer metadata.
        for (const key of ["content-encoding", "content-length", "transfer-encoding", "connection"])
          outgoing.delete(key);
        if (!config.forwardCredentials) outgoing.delete("set-cookie");
        return new Response(response.body, { status: response.status, headers: outgoing });
      } catch {
        return new Response("Remote RPC unavailable", { status: 502 });
      }
    },
  };
}
