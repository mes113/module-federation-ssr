declare module 'tanstack_rsbuild_ssr_remote/StatusCard' {
  import type { ComponentType } from 'react';
  const Card: ComponentType<{ action?: (value: number) => Promise<{ value: number }> }>;
  export default Card;
}

declare module 'tanstack_rsbuild_ssr_remote/probe' {
 export function remoteProbe(): Promise<{ owner: string; runtime: string; pid: number }>;
}
declare module 'tanstack_rsbuild_cart/StatusCard' {
  import type { ComponentType } from 'react';
  const Card: ComponentType<{ action?: (value: number) => Promise<{ value: number }> }>;
  export default Card;
}

declare module 'tanstack_rsbuild_cart/probe' {
 export function remoteProbe(): Promise<{ owner: string; runtime: string; pid: number }>;
}
