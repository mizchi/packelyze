import { defineConfig } from "vite";
import analyzed from "./_analyzed.json";

export default defineConfig({
  build: {
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
