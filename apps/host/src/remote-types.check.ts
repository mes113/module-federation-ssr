// Compile-time checks against downloaded remote declarations (no handwritten shims).
import type { ComponentProps } from "react";
import type CatalogCard from "tanstack_rsbuild_ssr_remote/StatusCard";
import type { remoteProbe as catalogProbe } from "tanstack_rsbuild_ssr_remote/probe";
import type { remoteProbe as cartProbe } from "tanstack_rsbuild_cart/probe";
type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type Assert<T extends true> = T;
export type RemoteTypeChecks = [
  Assert<Equal<Awaited<ReturnType<typeof catalogProbe>>["owner"], "remote">>,
  Assert<Equal<Awaited<ReturnType<typeof cartProbe>>["owner"], "cart">>,
  Assert<Equal<Awaited<ReturnType<typeof cartProbe>>["pid"], number>>,
];
// @ts-expect-error The remote component exposes no such prop.
export type InvalidProp = ComponentProps<typeof CatalogCard>["nonexistent"];
// @ts-expect-error PID is a number, not a string.
export type InvalidResult = Assert<Equal<Awaited<ReturnType<typeof cartProbe>>["pid"], string>>;
