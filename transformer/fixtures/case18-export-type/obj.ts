import type { Result, Obj, Input } from "./types";

export function createObj(): Obj {
  return {
    xxx,
    yyy(input: Input): Result {
      const ret: Result = {
        v1: input.v1 ?? "hello",
        v2: input.v2 ?? "world",
      };
      return {
        ...ret,
      };
    },
  };
  function xxx() {}
}
