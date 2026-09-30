import { spawn } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const serverDir = path.join(root, "server");

const localBin = path.join(os.homedir(), "AppData", "Local", "esbuild-bin", "esbuild.exe");
if (fs.existsSync(localBin)) {
  process.env.ESBUILD_BINARY_PATH = localBin;
}

const mode = process.argv[2] ?? "dev";

const tsxCli = path.join(serverDir, "node_modules", "tsx", "dist", "cli.mjs");
const entry =
  mode === "seed"
    ? path.join(serverDir, "src", "seed.ts")
    : path.join(serverDir, "src", "index.ts");

const args =
  mode === "dev"
    ? [tsxCli, "watch", "--tsconfig", "tsconfig.json", "src/index.ts"]
    : [tsxCli, "--tsconfig", "tsconfig.json", entry];

const child = spawn(process.execPath, args, {
  cwd: serverDir,
  stdio: "inherit",
  env: process.env,
});

child.on("exit", (code) => process.exit(code ?? 1));
