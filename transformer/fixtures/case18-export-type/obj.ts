import type { Result, Obj, Input } from "./types";

export function createObj(): Obj {
  return {
    xxx,
    yyy(input: Input) {
      const ret = {
        v1: input.v1 ?? "hello",
        v2: input.v2 ?? "world",
      };
      return {
        ...ret,
      };
    },
    zzz() {
      return [1, 2, 3].map((i) => {
        return {
          v1: i.toString(),
          v2: i.toString(),
        };
      });
    },
  };
  function xxx() {}
}
