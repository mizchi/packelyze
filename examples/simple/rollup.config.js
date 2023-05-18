import ts from "rollup-plugin-ts";
import terser from "@rollup/plugin-terser";
import analyzed from "./_analyzed.json" assert { type: "json" };

export default {
  input: "src/index.ts",
  output: {
    dir: "dist",
    format: "esm",
  },
  plugins: [
    ts(),
    terser({
      mangle: {
        properties: {
          regex: analyzed.manglePropertiesRegex
        }
      }
    }
  )],
}