import { expect, test } from "vitest";
import { stripWhitespaces } from "./printer";

test("stripWhitespaces", () => {
  const out = stripWhitespaces(
    `
    const x = 1;
    const y = {
      a: 1,
    };
    {
      const z   = 3;
    }

    function xyz() {
      return x + y.a;
    }
  `,
    "index.tsx",
  );
  expect(out).toBe(
    `const x = 1;const y = {a: 1};{const z = 3;}function xyz() {return x + y.a;}`,
    // TODO: strip whitespaces between tokens
    // `const x=1;const y={a:1};{const z=3;}function xyz(){return x+y.a;}`,
  );
});
