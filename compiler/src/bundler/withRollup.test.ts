import "../__tests/globals";

import { rollup } from "rollup";
import { expect, test } from "vitest";
import { getPlugin } from "./withRollup";
import path from "node:path";
import fs from "node:fs";

async function buildAndAssertExpected(projectPath: string) {
  const expectedPath = path.join(projectPath, "_expected.js");
  const inputPath = path.join(projectPath, "index.ts");

  expect(fs.existsSync(expectedPath)).toBe(true);
  expect(fs.existsSync(inputPath)).toBe(true);

  const expected = fs.readFileSync(expectedPath, "utf-8");
  const bundle = await rollup({
    input: inputPath,
    external: ["node:path"],
    plugins: [getPlugin({ projectPath })],
  });

  const { output } = await bundle.generate({
    format: "esm",
  });
  expect(output[0].code).toEqualFormatted(expected);
  return output[0].code;
}

// const skipList = ["case02-class"];
// const skipList: string[] = ["case-01", "case03-global", "case04-internal", "case05-effects"];
const skipList: string[] = [];
// const onlyList: string[] = ["case02-class"];
const onlyList: string[] = [];

const cases = fs
  .readdirSync(path.join(__dirname, "./__fixtures"))
  .filter((x) => x.startsWith("case"))
  .filter((caseName) => onlyList.length === 0 || onlyList.includes(caseName))
  .filter((caseName) => !skipList.includes(caseName));

for (const caseName of cases) {
  test(`rollup plugin #${caseName}`, async () => {
    const __dirname = path.dirname(new URL(import.meta.url).pathname);
    const projectPath = path.join(__dirname, "./__fixtures", caseName);
    await buildAndAssertExpected(projectPath);
  });
}
