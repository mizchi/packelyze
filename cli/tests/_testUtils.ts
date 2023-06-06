import { rollup } from "rollup";
import ts from "rollup-plugin-ts";
import terser, { type Options } from "@rollup/plugin-terser";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import process from "node:process";

export async function bundle(
  input: string,
  terserOptions: Options,
  rollupExternal: string[] = [],
) {
  const gen = await rollup({
    input,
    external: rollupExternal,
    plugins: [
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
