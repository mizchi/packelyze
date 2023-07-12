import { defineConfig } from "vite";
import { tsMinify } from "packelyze-transformer";

export default defineConfig((config) => {
  return {
    build: {
      modulePreload: {
        polyfill: false,
      },
    },
    plugins: [
      config.mode === "production" &&
        tsMinify({
          // only ts to minified-ts transform
          // vite's internal esbuild will consume it as ts to js
          preTransformOnly: true,
          // for vite entrypoint
          rootFileNames: ["./src/index.ts"],
        }),
    ],
  };
});
