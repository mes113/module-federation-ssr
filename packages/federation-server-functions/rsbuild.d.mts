import type { RsbuildPlugin } from '@rsbuild/core';
export interface GatewayTarget { origin: string; forwardCredentials?: boolean }
export function federationServerFunctions(options: {
  remote?: { name: string; origin: string };
  remotes?: Record<string, GatewayTarget>;
}): RsbuildPlugin;
