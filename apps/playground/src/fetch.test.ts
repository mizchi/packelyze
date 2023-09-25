import { expect, test } from "vitest";
import type { TypedJSON$stringify } from "zero-runtime";

const stringifyT = JSON.stringify as TypedJSON$stringify;

test("keep send body", async () => {
  const body = stringifyT({ keepMe: "hello" });
  expect(body).toMatchSnapshot();
});

// TODO: msw
