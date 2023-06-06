import { defineConfig } from "vite";
import analyzed from "./_optools-analyzed.json";
import { minify } from "terser";

export default defineConfig({
  plugins: [
    {
      // test
      name: "optools safety check",
      enforce: "post",
      async transform(code, id) {
        if (!process.env.OPTOOLS_CHECK) return;
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
