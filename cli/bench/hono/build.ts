import fs from "node:fs";
import path from "node:path";
import { bundleForCompare, execBuild } from "../_utils";
const cwd = path.dirname(new URL(import.meta.url).pathname);

await execBuild(cwd, { builtins: ["es", "dom", "cloudflareWorkers"] });

const analyzed = JSON.parse(
  fs.readFileSync(path.join(cwd, "analyzed.json"), "utf-8"),
);

const fileName = path.join(cwd, "input.ts");
await bundleForCompare(fileName, analyzed.reserved);
