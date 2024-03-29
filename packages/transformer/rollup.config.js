import cjs from "@rollup/plugin-commonjs";
import nodeResolve from "@rollup/plugin-node-resolve";
import ts from "rollup-plugin-ts";
export default {
  input: "src/index.ts",
  output: {
    dir: "dist",
    format: "esm",
    // sourcemap: true,
  },
  external: [
    "node:path",
    "node:process",
    "node:fs",
    "node:test",
    "rollup",
    "typescript",
    "source-map",
    "magic-string",
    "glob",
  ],
  plugins: [
    nodeResolve(),
    cjs(),
    ts({
      tsconfig: "tsconfig.build.json",
      compilerOptions: {
        sourcemap: true,
        declaration: true,
      },
    }),
  ],
};
