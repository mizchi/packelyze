import fs from "node:fs";
import path from "node:path";
import terser from "@rollup/plugin-terser";
import { rollup } from "rollup";
import ts from "rollup-plugin-ts";
import { test } from "vitest";
import { tsMinify } from "../src/index";
import "./globals";

async function compareBuildSize(projectPath: string) {
  const opted = await buildWithOptimizer(projectPath);
  const normal = await buildNormal(projectPath);
  console.log({
    target: projectPath,
    optedSize: opted.length,
    normalSize: normal.length,
    delta: opted.length - normal.length,
  });

  async function buildWithOptimizer(projectPath: string) {
    const inputPath = path.join(projectPath, "index.ts");

    const bundle = await rollup({
      input: inputPath,
      external: ["node:path", "myModule", "ext-a", "ext-b", "react", "react/jsx-runtime"],
      plugins: [
        // plugins
        tsMinify({ cwd: projectPath }),
        terser(),
      ],
    });
    const { output } = await bundle.generate({
      format: "esm",
    });
    // expect(output[0].code).toEqualFormatted(expected);
    return output[0].code;
  }

  async function buildNormal(projectPath: string) {
    const inputPath = path.join(projectPath, "index.ts");

    const bundle = await rollup({
      input: inputPath,
      external: ["node:path", "myModule", "ext-a", "ext-b", "react", "react/jsx-runtime"],
      plugins: [
        ts({
          transpileOnly: true,
          // wip
        }),
        terser({}),
      ],
    });

    const { output } = await bundle.generate({
      format: "esm",
    });
    return output[0].code;
  }
}

if (process.env.PERF) {
  // require tslib
  const skipList: string[] = ["case12", "case17"];
  const cases = fs
    .readdirSync(path.join(__dirname, "../fixtures"))
    .filter((x) => x.startsWith("case"))
    .filter((caseName) => {
      return !skipList.some((x) => caseName.startsWith(x));
    });
  for (const caseName of cases) {
    test(`rollup plugin #${caseName}`, async () => {
      const __dirname = path.dirname(new URL(import.meta.url).pathname);
      const projectPath = path.join(__dirname, "../fixtures", caseName);
      await compareBuildSize(projectPath);
    });
  }
} else {
  test.skip("perf requires PERF=1 ", () => {
    // nothing default
  });
}
