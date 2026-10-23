import { getRemoteStylesheets, lazyRemote } from '@module-federation/tanstack/runtime';
import { createFileRoute } from '@tanstack/react-router';
import { RemoteBoundary } from '../components/RemoteBoundary';
import { hostProbe, hostAction } from '../probe.functions';
const CatalogCard = lazyRemote(() => import('tanstack_rsbuild_ssr_remote/StatusCard'));
const CartCard = lazyRemote(() => import('tanstack_rsbuild_cart/StatusCard'));
async function probeRemote(load: () => Promise<{ owner: string; runtime: string; pid: number }>) {
  try { return { ok: true as const, data: await load() }; }
  catch { return { ok: false as const }; }
}
export const Route = createFileRoute('/')({
  loader: async () => {
    const [probe, stylesheets, catalog, cart] = await Promise.all([
      hostProbe(),
      Promise.all([3004, 3006].map(port => getRemoteStylesheets(`http://127.0.0.1:${port}/mf-manifest.json`, './StatusCard').catch(() => []))).then(lists => lists.flat()),
      probeRemote(() => import('tanstack_rsbuild_ssr_remote/probe').then(m => m.remoteProbe())),
      probeRemote(() => import('tanstack_rsbuild_cart/probe').then(m => m.remoteProbe())),
      import('tanstack_rsbuild_ssr_remote/StatusCard').catch(() => null),
      import('tanstack_rsbuild_cart/StatusCard').catch(() => null),
    ]);
    return { probe, stylesheets, catalog, cart };
  },
  head: ({ loaderData }) => ({ links: loaderData?.stylesheets.map(href => ({ href, rel: 'stylesheet' })) }),
  component: Home,
});
function Home() {
  const { probe, catalog, cart } = Route.useLoaderData();
  return <main className="page-shell">
    <p className="eyebrow">TanStack Start + Rsbuild / Rspack</p>
    <h1>SSR Federation Lab — two remotes</h1>
    <p data-testid="ssr-probe">SSR server function: {probe.owner} / {probe.runtime}</p>
    <p>Each remote has its own RPC namespace and backend process.</p>
    <div className="remote-grid">
      <section>
        <h2>Catalog · :3004</h2>
        {catalog.ok ? <>
          <p data-testid="catalog-ssr">Remote SSR RPC: {catalog.data.owner} / pid {catalog.data.pid} (host pid {probe.pid})</p>
          <RemoteBoundary fallback="Loading catalog…" name="Catalog">
            <CatalogCard action={value => hostAction({ data: value })} />
          </RemoteBoundary>
        </> : <p data-testid="catalog-unavailable">Catalog backend unavailable</p>}
      </section>
      <section>
        <h2>Cart · :3006</h2>
        {cart.ok ? <>
          <p data-testid="cart-ssr">Remote SSR RPC: {cart.data.owner} / pid {cart.data.pid} (host pid {probe.pid})</p>
          <RemoteBoundary fallback="Loading cart…" name="Cart">
            <CartCard action={value => hostAction({ data: value })} />
          </RemoteBoundary>
        </> : <p data-testid="cart-unavailable">Cart backend unavailable</p>}
      </section>
    </div>
  </main>;
}
