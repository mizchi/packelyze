import "../__tests/globals";
import { expect, test } from "vitest";
import { createTestLanguageService } from "../__tests/testHarness";
import { bundle, createModuleGraph } from "./bundler";

test("bundle", () => {
  const { service, normalizePath } = createTestLanguageService();
  // TODO: skip declare function
  const codeSub = `
  export function f() {
    return 1;
  }
  export function ff() {
    return 1;
  }
  export class C {
    public x: number = 1;
  }
  export const sub = () => 1;
  export const sub2 = () => 2;
`;

  const codeIndex = `
    import { sub, f as g, C, ff } from "./sub";
    export const x = sub();
  `;
  service.writeSnapshotContent(normalizePath("src/index.ts"), codeIndex);
  service.writeSnapshotContent(normalizePath("src/sub.ts"), codeSub);
  // const program = service.getProgram()!;
  const bundled = bundle(service, normalizePath("src/index.ts"));

  // console.log(bundled);
  expect(bundled).toBe(`const sub = () => 1;
const f = function g() { return 1; };
class C {
    public x: number = 1;
}
function ff() { return 1; }
export const x = sub();
`);
});

test("bundle #2 with scope access", () => {
  const { service, normalizePath } = createTestLanguageService();
  // TODO: skip declare function
  const codeSub = `
  const x = 1;
  export function f() {
    return internal();
  }
  function internal() {
    return x;
  }
`;
  const codeIndex = `
    import { f } from "./sub";
    export const x = f();
  `;

  service.writeSnapshotContent(normalizePath("src/index.ts"), codeIndex);
  service.writeSnapshotContent(normalizePath("src/sub.ts"), codeSub);
  // const program = service.getProgram()!;
  const bundled = bundle(service, normalizePath("src/index.ts"));
  expect(bundled).toBe(`const x = 1;
function internal() { return x; }
function f() { return internal(); }
export const x = f();
`);

  // console.log(bundled);
});

test.skip("reference graph", () => {
  const { service, normalizePath } = createTestLanguageService();
  const codeSub = `
  const subLocal = 1;
  export function f() {
    return subLocal;
  }
  export function ff() {
    return 1;
  }
  `;
  const codeFoo = `
  const fooLocal = 2;
  export function foo() {
    return fooLocal;
  }
  `;

  const codeBar = `
  import { bar } from "./bar";
  export function bar() {
    return foo();
  }
  `;

  const codeIndex = `
    import { f as g, ff } from "./sub";
    import { bar } from "./bar";
    // export const x = g() + ff() + bar();
    export const x = g();
    export const y = ff();
    export const z = bar();
  `;
  service.writeSnapshotContent(normalizePath("src/index.ts"), codeIndex);
  service.writeSnapshotContent(normalizePath("src/sub.ts"), codeSub);
  service.writeSnapshotContent(normalizePath("src/foo.ts"), codeFoo);
  service.writeSnapshotContent(normalizePath("src/bar.ts"), codeBar);
  const program = service.getProgram()!;
  const graph = createModuleGraph(program, program.getSourceFile(normalizePath("src/index.ts"))!);
  // console.log(flattenGraph(graph));
});
