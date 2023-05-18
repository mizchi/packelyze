export type TypedJSONString<T> = string & { __type: T };

// type Stringable = string | number | boolean | null | undefined;
// export function String$concat<A extends Stringable, B extends Stringable>(
//   a: A,
//   b: B,
// ): `${A}${B}` {
//   return `${a}${b}`;
// }

// if (import.meta.vitest) {
//   const t: "foo" = String$concat("f", "oo");
// }
