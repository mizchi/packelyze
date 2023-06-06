import fs from "node:fs";
import path from "node:path";
import { bundleForCompare, execBuild } from "../_utils";
const cwd = path.dirname(new URL(import.meta.url).pathname);

await execBuild(cwd, { builtins: ["es", "node"] });
const fileName = path.join(cwd, "input.ts");

const analyzed = JSON.parse(
  fs.readFileSync(path.join(cwd, "analyzed.json"), "utf-8"),
);
await bundleForCompare(fileName, analyzed.reserved);
