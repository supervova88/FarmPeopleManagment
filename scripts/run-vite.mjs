import { spawn } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";

// На некоторых корпоративных машинах postinstall esbuild не отрабатывает,
// поэтому используем заранее подготовленный бинарник, если он есть.
const localBin = path.join(os.homedir(), "AppData", "Local", "esbuild-bin", "esbuild.exe");
if (fs.existsSync(localBin)) {
  process.env.ESBUILD_BINARY_PATH = localBin;
}

const cmd = process.argv[2] ?? "dev";
const args = cmd === "dev" ? [] : [cmd];
const vite = path.join(process.cwd(), "node_modules", "vite", "bin", "vite.js");
const child = spawn(process.execPath, [vite, ...args], {
  stdio: "inherit",
  env: process.env,
});
child.on("exit", (code) => process.exit(code ?? 1));
