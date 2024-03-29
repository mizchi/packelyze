import terser from "@rollup/plugin-terser";
import ts from "rollup-plugin-ts";
import analyzed from "./_packelyze-analyzed.json" assert { type: "json" };

export default {
  input: "src/index.ts",
  output: {
    dir: "dist",
    format: "esm",
  },
  external: ["react/jsx-runtime"],
  plugins: [
    ts(),
    terser({
      compress: false,
      mangle: {
        properties: {
          builtins: false,
          regex: /^.*$/,
          reserved: analyzed.reserved,
        },
      },
    }),
  ],
};
