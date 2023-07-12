import { defineConfig } from "vite";
// import analyzed from "./_packelyze-analyzed.json";
import { tsMinify } from "packelyze-transformer";

export default defineConfig({
  build: {
    modulePreload: {
      polyfill: false,
    },
  },
  plugins: [
    tsMinify({
      preTransformOnly: true,
      rootFileNames: ["./src/index.ts"],
    }),
  ],
  // Does not work: can not rename with library internals.
  // esbuild: {
  //   mangleProps: /.*/,
  //   reserveProps: new RegExp(`^(${reserved})$`),
  // },
});
