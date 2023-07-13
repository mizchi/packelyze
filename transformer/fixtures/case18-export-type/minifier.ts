type Result = {
  value: string;
};

export interface Obj {
  xxx(): void;
  yyy(): Result;
}

export function createObj(): Obj {
  return {
    xxx,
    yyy(): Result {
      const ret: Result = {
        value: "hello",
      };
      return ret;
    },
  };
  function xxx() {}
}
