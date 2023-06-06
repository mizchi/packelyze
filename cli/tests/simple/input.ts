export const foo = {
  bar: 1,
};

export function f() {
  // should keep .filter
  return [].filter((x) => x);
}

export class X {
  a: number = 1;
  "b": boolean;
  f(): void {}
  "g"(): void {}
  private pf(): void {}
  private z = null;
}

export enum MyEnum {
  A,
  B,
  C = 100,
}

const internal = {
  xxxxx: 1,
};
console.log(internal.xxxxx);
