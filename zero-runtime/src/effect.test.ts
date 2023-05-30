import { expect, test } from "vitest";
import type { __EFF__, Eff } from "./effect";

type ThrowableEffect<T> = { type: "throwable"; constructor: T };

test("declare throwable return type", () => {
  class MyError extends Error {}
  function doSomething(
    num: number,
  ): string & Eff<ThrowableEffect<typeof MyError>> {
    if (Math.random() > num) {
      throw new MyError("oops");
    }
    return "foo";
  }

  try {
    const ret = doSomething(0.8);
    expect(ret).toBe("foo");
    const _: string = ret satisfies string;
  } catch (error) {
    if (error instanceof MyError) {
      expect(error.message).toBe("oops");
    } else {
      throw new Error("unexpected error");
    }
  }
});
