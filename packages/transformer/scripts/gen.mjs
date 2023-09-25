import fs from "node:fs";
import path from "node:path";

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const cases = fs.readdirSync(path.join(__dirname, "../fixtures")).filter((x) => x.startsWith("case"));

const pre = `import "./globals";
import path from "node:path";
import { test } from "vitest";
import { assertRollupWithFixture } from "./testUtils";

`;

const genCase = (caseName) => `test("rollup #${caseName}", async () => {
  await assertRollupWithFixture(path.join(__dirname, "../fixtures/${caseName}"));
});`;

const TEST_SIZE_PER_FILE = 10;
const testFileCount = Math.ceil(cases.length / TEST_SIZE_PER_FILE);
for (let i = 0; i < testFileCount; i++) {
  const start = i * TEST_SIZE_PER_FILE;
  const end = (i + 1) * TEST_SIZE_PER_FILE;
  fs.writeFileSync(
    path.join(__dirname, `../test/_gen${start}-${end - 1}.test.ts`),
    pre +
      cases
        .slice(start, end)
        .filter((x) => {
          console.log("filtering", x, cases.includes(x));
          return cases.includes(x);
          // const exists = fs.existsSync(path.join(__dirname, `../test/_gen${start}-${end - 1}.test.ts`));
          // if (exists) {
          //   return x.includes("rollup #case");
          // }
          // return true;
        })
        .map(genCase)
        .join("\n"),
  );
}
