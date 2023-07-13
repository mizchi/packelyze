import { expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { rollup } from "rollup";
import { tsMinify } from "../src";
import ts from "typescript";
import prettier from "prettier";

export function formatTs(code: string) {
  return prettier.format(code, {
    filepath: "$.tsx",
    parser: "typescript",
    semi: true,
  });
}

export async function assertRollupWithFixture(projectPath: string) {
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
