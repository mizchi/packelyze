import path from "node:path";
import fs from "node:fs";
import { rollup } from "rollup";
import ts from "rollup-plugin-ts";
// @ts-ignore
import nodeResolve from "@rollup/plugin-node-resolve";
import terser, { type Options } from "@rollup/plugin-terser";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import process from "node:process";
import zlib from "node:zlib";
import commonjs from "@rollup/plugin-commonjs";

export async function bundle(input: string, terserOptions: Options) {
  const gen = await rollup({
    input,
    plugins: [
      nodeResolve(),
      commonjs(),
      ts({
        transpileOnly: true,
      }),
      terser(terserOptions),
    ],
  });
  const output = await gen.generate({
    format: "es",
  });
  return output.output[0].code;
}

export async function bundleForCompare(input: string, reserved: string[]) {
  const dirname = path.dirname(input);
  const raw = await bundle(input, {});
  const opt = await bundle(input, {
    mangle: {
      properties: {
        builtins: true,
        regex: /^.*/,
        reserved: reserved,
      },
    },
  });
  const gzipAsync = promisify(zlib.gzip);
  const rawGzip = await gzipAsync(raw);
  const optGzip = await gzipAsync(opt);

  fs.writeFileSync(path.join(dirname, `_bundle.raw.js`), raw);
  fs.writeFileSync(path.join(dirname, `_bundle.opt.js`), opt);
  fs.writeFileSync(path.join(dirname, `_bundle.raw.js.gz`), rawGzip);
  fs.writeFileSync(path.join(dirname, `_bundle.opt.js.gz`), optGzip);
  console.log(`raw: ${raw.length} bytes, ${rawGzip.length} bytes gzipped`);
  console.log(`opt: ${opt.length} bytes, ${optGzip.length} bytes gzipped`);
}

export async function execBuild(
  cwd: string = process.cwd(),
  opts: { builtins?: string[] } = {},
) {
  const execAsync = promisify(exec);
  const p = await execAsync(
    `pnpm tsc -p . --emitDeclarationOnly --declaration && tsm ../../src/cli.mts analyze-dts -i input.d.ts -o analyzed.json ${
      (opts.builtins ?? []).map((b) => `-b ${b}`).join(" ")
    }`,
    {
      cwd: cwd,
    },
  );
  console.log(p.stdout);
  console.log(p.stderr);
  return p;
}
