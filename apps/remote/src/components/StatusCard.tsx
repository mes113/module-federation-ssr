import { useHostName } from "example-host-context";
import { useEffect, useState } from "react";
import "./StatusCard.css";
import { remoteProbe } from "../probe.functions";

export default function StatusCard({ action }: { action?: (value: number) => Promise<{ value: number }> }) {
  const [rpc, setRpc] = useState('Not called');
  const [nativeRpc, setNativeRpc] = useState('Not called');
  const hostName = useHostName();
  const [count, setCount] = useState(0);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  return (
    <article className="rsbuild-ssr-card" data-remote="catalog">
      <p className="eyebrow">Federated SSR from Rsbuild</p>
      <p className="remote-status">
        {hydrated ? "Hydrated on the host" : "Rendered on the server"}
      </p>
      <h2>Server-rendered by an Rsbuild remote.</h2>
      <p>The host's server loaded this card from the remote's async-node container.</p>
      <p className="host-name">Host: {hostName}</p>
      <button onClick={async () => { try { if (!action) throw new Error('No host action'); const result = await action(count); setCount(result.value); setRpc('Host server function OK'); } catch (e) { setRpc(String(e)); } }}>Call host server function</button>
      <p data-testid="host-rpc">{rpc}</p>
      <button onClick={async () => { try { const result = await remoteProbe(); setNativeRpc(JSON.stringify(result)); } catch (e) { setNativeRpc('Remote RPC failed: ' + String(e)); } }}>Call remote native server function</button>
      <p data-testid="remote-rpc">{nativeRpc}</p>
      <button type="button" onClick={() => setCount((value) => value + 1)}>
        Remote count {count}
      </button>
    </article>
  );
}
