import path from "node:path";
import fs from "node:fs";

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const cases = fs.readdirSync(path.join(__dirname, "./fixtures")).filter((x) => x.startsWith("case"));

const pre = `import "./globals";
import path from "node:path";
import { test } from "vitest";
import { assertRollupWithFixture } from "./testUtils";

`;

const genCase = (caseName) => `test("rollup #${caseName}", async () => {
  await assertRollupWithFixture(path.join(__dirname, "./fixtures/${caseName}"));
});`;

const TEST_SIZE_PER_FILE = 8;
const testFileCount = Math.ceil(cases.length / TEST_SIZE_PER_FILE);
for (let i = 0; i < testFileCount; i++) {
  fs.writeFileSync(
    path.join(__dirname, `./rollup-${i}.test.ts`),
    pre +
      cases
        .slice(i * TEST_SIZE_PER_FILE, (i + 1) * TEST_SIZE_PER_FILE)
        .map(genCase)
        .join("\n"),
  );
}
