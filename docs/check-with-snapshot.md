# Check with snapshot testing

WIP

## Check with snapshots

Still worried? You can check mangling result with snapshot testings.

```ts
// vite.config.ts
import { defineConfig } from "vite";
import analyzed from "./_analyzed.json";
import { minify } from "terser";

export default defineConfig({
  plugins: [
    {
      name: "packelyze safety check",
      enforce: "post",
      async transform(code, id) {
        if (!process.env.packelyze_CHECK) return;
        if (id.endsWith(".js")) {
          const result = await minify(code, {
            compress: false
            mangle: {
              module: true,
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
});
```

Put tests.

```ts
// src/fetch.test.ts
import { expect, test } from "vitest";
import type { TYpedJSON$stringify } from "zero-runtime";

const stringifyT = JSON.stringify as TypedJSON$stringify;

test("keep send body", async () => {
  // In this case, fetch effects types includes `keepMe`
  const body = stringifyT({ keepMe: "hello" });
  expect(body).toMatchSnapshot();
});
```

Run test twice with `packelyze_CHECK`.

```bash
$ pnpm vitest --run # it creates __snapshot__
$ packelyze_CHECK=1 pnpm vitest --run # should match with result with mangling
```

