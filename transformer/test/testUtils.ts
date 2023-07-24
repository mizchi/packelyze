import { expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { Plugin, rollup } from "rollup";
import { TsMinifyOptions, tsMinify, withTerserMangleValidator, aggressiveMangleValidator } from "../src";
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
  let tsMinifyPlugin: (options?: TsMinifyOptions) => Plugin;

  // USE SELFHOST MODE
  if (!!process.env.SELFHOST) {
    try {
      // @ts-ignore
      tsMinifyPlugin = ((await import("../lib/index.js")) as any).tsMinify;
    } catch (err) {
      throw err;
    }
  } else {
    tsMinifyPlugin = tsMinify;
  }

  const expectedPath = path.join(projectPath, "_expected.js");
  const inputPath = path.join(projectPath, "index.ts");

  expect(fs.existsSync(inputPath)).toBe(true);

  const bundle = await rollup({
    input: inputPath,
    onwarn(warning, defaultHandler) {
      if (warning.code === "THIS_IS_UNDEFINED") return;
      defaultHandler(warning);
    },
    external: ["node:path", "react", "react/jsx-runtime", "myModule", "external-xxx", "ext-a", "ext-b"],
    plugins: [
      tsMinifyPlugin({
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
        mangleValidator: withTerserMangleValidator,
        withOriginalComment: true,
      }),
    ],
  });
  const { output } = await bundle.generate({
    format: "esm",
  });

  const formatted = formatTs(output[0].code);
  expect(formatted).toMatchFileSnapshot(expectedPath);
}
