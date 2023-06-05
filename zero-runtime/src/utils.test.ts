import type { Assert, Eq } from "./utils";
type _cases = [
  Assert<Eq<1, 1>>,
  // @ts-ignore
  Assert<Eq<string | number, string>>,
  // @ts-expect-error
  Assert<Eq<any, never>>,
];
