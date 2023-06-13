import { defineConfig } from "vite";
import analyzed from "./_packelyze-analyzed.json";
import { minify } from "terser";

export default defineConfig({
  plugins: [
    {
      // test
      name: "packelyze safety check",
      enforce: "post",
      async transform(code, id) {
        if (!process.env.packelyze_CHECK) return;
        if (id.endsWith(".js")) {
          const result = await minify(code, {
            mangle: {
              properties: {
                regex: /^.*$/,
                reserved: analyzed.reserved,
              },
            },
          });
          return result.code;
        }
      },
    },
  ],
  build: {
    terserOptions: {
      mangle: {
        properties: {
          regex: /^.*$/,
          reserved: analyzed.reserved,
        },
      },
    },
  },
});
