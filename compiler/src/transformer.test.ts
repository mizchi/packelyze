import {expect, test} from "vitest";
import { isPreprocessedNeeded, preprocess } from "./transformer";
import { createSourceFile, ScriptTarget } from "typescript";

test("isPreprocessedNeeded", () => {
  expect(isPreprocessedNeeded(`export const x = 1;`)).toBe(true);
  expect(isPreprocessedNeeded(`const x = 1;`)).toBe(false);
  expect(isPreprocessedNeeded(`const x = 1;export{x}`)).toBe(false);
  expect(isPreprocessedNeeded(`export const x = 1;const y=1;export{y}`)).toBe(true);

  expect(isPreprocessedNeeded(`export type X = number;`)).toBe(true);
  expect(isPreprocessedNeeded(`export type {}`)).toBe(false);
  expect(isPreprocessedNeeded(`export type{}`)).toBe(false);
});

test("preprocess", () => {
  const source = createSourceFile(
    "index.ts",
    `
    export const x = 1;
    `,
    ScriptTarget.Latest,
    true
  );
  const preprocessed = preprocess(source);
  expect(preprocessed).toBe(`const x = 1;\nexport { x };\n`);
});

test("preprocess without namedExportsn", () => {
  const source = createSourceFile(
    "index.ts",
    `
    export default 1;
    `,
    ScriptTarget.Latest,
    true
  );
  const preprocessed = preprocess(source);
  expect(preprocessed).toBe(`export default 1;\n`);
});

test("preprocess export declaration", () => {
  const source = createSourceFile(
    "index.ts",
    `
    export { sub } from "./sub";
    export const x = 1;
    export function f() {}
    export class C {}
    export enum E {}

    export type T = number;
    export interface I {}

    const local = 1;
    {
      const nested = 2;
    }

    const v = 1;
    const y = 2;
    export {
      v,
      y as z
    }
    `,
    ScriptTarget.Latest,
    true
  );
  const preprocessed = preprocess(source);
  expect(preprocessed).toBe(`export { sub } from "./sub";
const x = 1;
function f() { }
class C {
}
enum E {
}
type T = number;
interface I {
}
const local = 1;
{
    const nested = 2;
}
const v = 1;
const y = 2;
export { v, y as z, x, f, C, E, T, I };
`);
});

