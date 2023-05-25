import { defineConfig } from "vite";
import analyzed from "./_analyzed.json";

export default defineConfig({
  build: {
    // use terser: because esbuild does not support mangle properties builtins
    minify: "terser",
    terserOptions: {
      mangle: {
        properties: {
          regex: /^.*/,
          reserved: analyzed.reserved,
        },
      },
    },
  },
});
