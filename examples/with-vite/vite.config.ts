import { defineConfig } from "vite";
import analyzed from "./_analyzed.json";

const reserved = analyzed.reserved
  // .filter((x) => !x.includes("$"))
  .map((t) => t.replace("$", "\\$"))
  .join("|");
export default defineConfig({
  build: {
    // use terser: because esbuild does not support mangle properties builtins
    minify: "terser",
    terserOptions: {
      mangle: {
        properties: {
          builtins: true,
          regex: /^.*/,
          reserved: analyzed.reserved,
        },
      },
    },
  },
  // Does not work: can not rename with library internals.
  // esbuild: {
  //   mangleProps: /.*/,
  //   reserveProps: new RegExp(`^(${reserved})$`),
  // },
});
