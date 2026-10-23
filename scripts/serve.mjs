import { spawn } from "node:child_process";
const mode = process.argv[2] || "dev";
if (!["dev", "preview"].includes(mode)) throw new Error("Use dev or preview");
const children = ["remote", "remote-cart", "host"].map((app) =>
  spawn("npm", ["run", mode, "-w", `apps/${app}`], { stdio: "inherit", detached: true }),
);
function stop() {
  for (const child of children) {
    try {
      process.kill(-child.pid, "SIGTERM");
    } catch {}
  }
}
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => {
    stop();
    process.exit();
  });
for (const child of children)
  child.on("exit", (code) => {
    stop();
    process.exit(code || 0);
  });
