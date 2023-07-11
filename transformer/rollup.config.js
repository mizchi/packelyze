import ts from "rollup-plugin-ts";
import nodeResolve from "@rollup/plugin-node-resolve";
import cjs from "@rollup/plugin-commonjs";
export default {
  input: "src/index.ts",
  output: {
    dir: "dist",
    format: "esm",
  },
  external: ["typescript", "node:path", "node:process", "node:fs", "node:test", "rollup"],
  plugins: [
    nodeResolve(),
    cjs(),
    ts({
      tsconfig: "tsconfig.build.json",
      compilerOptions: {
        declaration: true,
      }
    })
  ],
};