import "./globals";

import { rollup } from "rollup";
import { expect, test } from "vitest";
import { tsMinify } from "../src/index";
import path from "node:path";
import fs from "node:fs";
import ts from "typescript";

async function assertResultToExpected(projectPath: string) {
  const expectedPath = path.join(projectPath, "_expected.js");
  const inputPath = path.join(projectPath, "index.ts");

  expect(fs.existsSync(expectedPath)).toBe(true);
  expect(fs.existsSync(inputPath)).toBe(true);

  const expected = fs.readFileSync(expectedPath, "utf-8");
  const bundle = await rollup({
    input: inputPath,
    onwarn(warning, defaultHandler) {
      if (warning.code === "THIS_IS_UNDEFINED") return;
      defaultHandler(warning);
    },
    external: ["node:path", "react", "react/jsx-runtime", "myModule", "external-xxx", "ext-a", "ext-b"],
    plugins: [
      tsMinify({
        cwd: projectPath,
        compilerOptions: {
          target: ts.ScriptTarget.ESNext,
          module: ts.ModuleKind.ESNext,
          experimentalDecorators: true,
        },
        transpileOptions: {
          target: ts.ScriptTarget.ESNext,
          module: ts.ModuleKind.ESNext,
          experimentalDecorators: true,
        },
      }),
    ],
  });
  const { output } = await bundle.generate({
    format: "esm",
  });
  expect(output[0].code).toEqualFormatted(expected);
  return output[0].code;
}

const skipList: string[] = [];
// WIP
// const skipList: string[] = ["case07-react"];
const onlyList: string[] = [];

const cases = fs
  .readdirSync(path.join(__dirname, "./fixtures"))
  .filter((x) => x.startsWith("case"))
  .filter((caseName) => onlyList.length === 0 || onlyList.includes(caseName))
  .filter((caseName) => !skipList.includes(caseName));

for (const caseName of cases) {
  test(`rollup plugin #${caseName}`, async () => {
    const __dirname = path.dirname(new URL(import.meta.url).pathname);
    const projectPath = path.join(__dirname, "./fixtures", caseName);
    await assertResultToExpected(projectPath);
  });
}