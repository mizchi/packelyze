export interface Obj {
  xxx(): void;
  yyy(): string | undefined;
}

export function createObj(): Obj {
  return {
    xxx,
    yyy(): string | undefined {
      return undefined;
    },
  };

  function xxx() {}
}
