import { expect, test } from "vitest";
import type { JSON$stringifyT } from "@mizchi/zero-runtime";

const stringifyT = JSON.stringify as JSON$stringifyT;

test("keep send body", async () => {
  const body = stringifyT({ keepMe: "hello" });
  expect(body).toMatchSnapshot();
});

// TODO: msw
