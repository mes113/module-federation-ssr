import { createIsomorphicFn } from "@tanstack/react-start";
const names = ["catalog", "cart"] as const;
export const manifests = createIsomorphicFn()
  .server(() =>
    names.map((name, i) => ({
      name,
      url: `${process.env[name === "catalog" ? "CATALOG_INTERNAL_ORIGIN" : "CART_INTERNAL_ORIGIN"] || `http://127.0.0.1:${i ? 3006 : 3004}`}/mf-manifest.json`,
    })),
  )
  .client(() =>
    names.map((name, i) => ({
      name,
      url: import.meta.env.LAB_SINGLE_ORIGIN
        ? `${import.meta.env.LAB_PUBLIC_ORIGIN}/_remotes/${name}/mf-manifest.json`
        : `http://127.0.0.1:${i ? 3006 : 3004}/mf-manifest.json`,
    })),
  );
export function publicStylesheet(name: string, href: string) {
  return import.meta.env.LAB_SINGLE_ORIGIN
    ? `${import.meta.env.LAB_PUBLIC_ORIGIN}/_remotes/${name}${new URL(href).pathname}`
    : href;
}
