import { createServerFn } from "@tanstack/react-start";
export const hostProbe = createServerFn({ method: "GET" }).handler(async () => ({
  owner: "host",
  runtime: typeof process,
  pid: process.pid,
}));
export const hostAction = createServerFn({ method: "POST" })
  .validator((data: number) => {
    if (!Number.isInteger(data) || data < 0) throw new Error("Expected nonnegative integer");
    return data;
  })
  .handler(async ({ data }) => ({ owner: "host", value: data + 1, runtime: typeof process }));
