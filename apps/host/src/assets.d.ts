declare module "*.css?url" {
  const href: string;
  export default href;
}

interface ImportMeta {
  env: { LAB_SINGLE_ORIGIN: boolean; LAB_PUBLIC_ORIGIN: string };
}
