import { spawn } from "node:child_process";
const children = [
  ...["remote", "remote-cart", "host"].map((app) =>
    spawn(process.execPath, ["scripts/node-server.mjs", app], { stdio: "inherit", detached: true }),
  ),
  spawn(process.execPath, ["scripts/edge-server.mjs"], { stdio: "inherit", detached: true }),
];
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
