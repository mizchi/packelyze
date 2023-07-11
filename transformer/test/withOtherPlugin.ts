import "./globals";
import { test, expect } from "vitest";
import { tsMinify } from "../src/index";
import { rollup } from "rollup";
import path from "node:path";
import fs from "node:fs";
import typescript from "typescript";
import ts from "rollup-plugin-ts";
import esbuild from "rollup-plugin-esbuild";

test(`with rollup-plugin-ts`, async () => {
  const projectPath = path.join(__dirname, "./fixtures/case01-basic");
  const expectedPath = path.join(projectPath, "_expected.js");
  const inputPath = path.join(projectPath, "index.ts");
  const expected = fs.readFileSync(expectedPath, "utf-8");
  const bundle = await rollup({
    input: inputPath,
    external: ["node:path"],
    plugins: [
      tsMinify({
        cwd: projectPath,
        preTransformOnly: true,
        compilerOptions: {
          target: typescript.ScriptTarget.ESNext,
          module: typescript.ModuleKind.ESNext,
          experimentalDecorators: true,
        },
      }),
      ts({
        cwd: projectPath,
      }),
    ],
  });
  const { output } = await bundle.generate({
    format: "esm",
  });
  expect(output[0].code).toEqualFormatted(expected);
});

test(`with rollup-plugin-esbuild`, async () => {
  const projectPath = path.join(__dirname, "./fixtures/case01-basic");
  const expectedPath = path.join(projectPath, "_expected.js");
  const inputPath = path.join(projectPath, "index.ts");
  const expected = fs.readFileSync(expectedPath, "utf-8");
  const bundle = await rollup({
    input: inputPath,
    external: ["node:path"],
    plugins: [
      tsMinify({
        cwd: projectPath,
        preTransformOnly: true,
        compilerOptions: {
          target: typescript.ScriptTarget.ESNext,
          module: typescript.ModuleKind.ESNext,
          experimentalDecorators: true,
        },
      }),
      esbuild({
        include: /\.m?[jt]sx?$/,
      }),
    ],
  });
  const { output } = await bundle.generate({
    format: "esm",
  });
  expect(output[0].code).toEqualFormatted(expected);
});

test(`preTransformOnly can not bundle by itself`, async () => {
  const projectPath = path.join(__dirname, "./fixtures/case01-basic");
  const inputPath = path.join(projectPath, "index.ts");
  try {
    await rollup({
      input: inputPath,
      external: ["node:path", "react", "react/jsx-runtime", "myModule", "external-xxx", "ext-a", "ext-b"],
      plugins: [
        tsMinify({
          cwd: projectPath,
          preTransformOnly: true,
        }),
      ],
    });
    throw new Error("unreachable");
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === "unreachable") throw err;
      expect(err.message).contains("Unexpected token");
    }
  }
});
