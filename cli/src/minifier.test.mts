import { minify } from "terser";

// Minifier itself tests
if (import.meta.vitest) {
  const { test, expect } = import.meta.vitest;
  test("minifier check 1", async () => {
    const out = await minify(
      `export const obj = { xxx: 1 };
      export const c = obj.constructor; Array.isArray(c);
      `,
      {
        module: true,
        compress: false,
        mangle: {
          properties: {
            regex: /^.*/,
          },
        },
      },
    );
    expect(out.code).includes(".constructor");
    expect(out.code).includes("Array.isArray");
  });

  test("minifier check 2", async () => {
    const out = await minify(
      `
      const arr = [1, 2, 3];
      // keep .map
      export const ret = arr.map((x) => x + 1);
      `,
      {
        module: true,
        compress: false,
        mangle: {
          properties: {
            regex: /^.*/,
          },
        },
      },
    );
    expect(out.code).includes(".map");
  });

  test("minifier check 3", async () => {
    const out = await minify(
      `
      const divs = document.querySelectorAll("div");
      export const r = [...divs].map((div) => div.classList.add("foo"));
      `,
      {
        module: true,
        // compress: false,
        mangle: {
          module: true,
          properties: {
            builtins: false,
            regex: /^.*/,
          },
        },
      },
    );
    // console.log(out.code);
    expect(out.code).includes(".classList.add");
  });
  test("minifier check 4", async () => {
    const out = await minify(
      `
      const a = globalRef;
      export const x = a.classList.add("foo");
      `,
      {
        module: true,
        compress: false,
        mangle: {
          module: true,
          properties: {
            regex: /^.*/,
          },
        },
      },
    );
    // console.log(out.code);
    expect(out.code).includes(".classList.add");
  });

  test("minifier check 5: reserved vs regex", async () => {
    const out = await minify(
      `
      export const a = {
        foo: 1,
        bar: 2,
        baz: 3
      };
      `,
      {
        module: true,
        compress: false,
        mangle: {
          module: true,
          properties: {
            regex: /^.*/,
            reserved: ["foo", "bar"],
          },
        },
      },
    );
    // console.log(out.code);
    expect(out.code).includes("foo");
    expect(out.code).includes("bar");
    expect(out.code).not.includes("baz");
  });
}
