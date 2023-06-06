import fs from "node:fs";
import path from "node:path";

process.removeAllListeners("warning");

const benchDir = path.join(process.cwd(), "bench");

const targets = fs.readdirSync(benchDir, { withFileTypes: true }).filter((f) =>
  f.isDirectory()
).map((t) => path.join(benchDir, t.name));

for (const target of targets) {
  console.log("---", target.replace(process.cwd(), "."));
  await import(path.join(target, "build.ts"));
}

// console.log(targets);
