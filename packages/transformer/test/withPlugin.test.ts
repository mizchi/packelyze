import fs from "node:fs";
import path from "node:path";
import { rollup } from "rollup";
import esbuild from "rollup-plugin-esbuild";
import ts from "rollup-plugin-ts";
import typescript from "typescript";
import { expect, test } from "vitest";
import { tsMinify, withTerserMangleValidator } from "../src/index";
import "./globals";

test(`with rollup-plugin-ts`, async () => {
  const projectPath = path.join(__dirname, "../fixtures/case01-basic");
  const inputPath = path.join(projectPath, "index.ts");
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
        withOriginalComment: true,
        mangleValidator: withTerserMangleValidator,
      }),
      ts({
        cwd: projectPath,
        transpileOnly: true,
      }),
    ],
  });
  const { output } = await bundle.generate({
    format: "esm",
  });
  expect(output[0].code).toMatchSnapshot();
});

test(`with rollup-plugin-esbuild`, async () => {
  const projectPath = path.join(__dirname, "../fixtures/case01-basic");
  const inputPath = path.join(projectPath, "index.ts");
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
        withOriginalComment: true,
        mangleValidator: withTerserMangleValidator,
      }),
      esbuild({
        include: /\.m?[jt]sx?$/,
      }),
    ],
  });
  const { output } = await bundle.generate({
    format: "esm",
  });
  // expect(output[0].code).toEqualFormatted(expected);
  expect(output[0].code).toMatchSnapshot();
});

test(`preTransformOnly can not bundle by itself`, async () => {
  const projectPath = path.join(__dirname, "../fixtures/case01-basic");
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
