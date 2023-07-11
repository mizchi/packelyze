import "../__tests/globals";
import path from "node:path";
import { expect, test } from "vitest";
import { createTestLanguageService } from "../__tests/testHarness";
import { deleteUnusedInProject, deleteUnusedInProjectUntilNoErrors } from "./unused";

const projectPath = path.join(__dirname, "../../test/fixtures/minimum-unused");

test("TS: unused", async () => {
  const code = `
  const x = 1;
  const unused_local1 = 2;
  const finaly_unused = 3;
  const unused_local2 = finaly_unused;
  function foo(a: number, unused_param: number) {
    return a;
  }
  export {
    x, foo
  }
  `;
  const { service } = createTestLanguageService(projectPath);
  service.writeSnapshotContent("index.ts", code);
  expect(service.getSemanticDiagnostics("index.ts")).toHaveLength(3);
  deleteUnusedInProject(service);
  expect(service.readSnapshotContent("index.ts")).toEqualFormatted(`
    const x = 1;
    const finaly_unused = 3;
    function foo(a: number) {
        return a;
    }
    export { x, foo };
  `);

  expect(service.getSemanticDiagnostics("index.ts")).toHaveLength(1);
  deleteUnusedInProject(service);
  expect(service.getSemanticDiagnostics("index.ts")).toHaveLength(0);
  expect(service.readSnapshotContent("index.ts")).toEqualFormatted(`
    const x = 1;
    function foo(a: number) {
        return a;
    }
    export { x, foo };
  `);
});

test("TS: delete unused until no error", async () => {
  const code = `
  const x = 1;
  const unused_local1 = 2;
  const finaly_unused = 3;
  const unused_local2 = finaly_unused;
  function foo(a: number, unused_param: number) {
    return a;
  }
  export {
    x, foo
  }
  `;
  const { service } = createTestLanguageService(projectPath);
  service.writeSnapshotContent("index.ts", code);
  deleteUnusedInProjectUntilNoErrors(service);
  expect(service.getSemanticDiagnostics("index.ts")).toHaveLength(0);
  expect(service.readSnapshotContent("index.ts")).toEqualFormatted(`
    const x = 1;
    function foo(a: number) {
        return a;
    }
    export { x, foo };
  `);
});

test("TS: delete unused until no error", async () => {
  const code = `
  let x: number;
  if (false) {
    x = 1;
    console.log("unreachable", x);
  }
  export default 1;
  `;
  const { service } = createTestLanguageService(projectPath);
  service.writeSnapshotContent("index.ts", code);
  expect(service.getSemanticDiagnostics("index.ts")).toHaveLength(0);

  // expect(service.getSemanticDiagnostics("index.ts")).toHaveLength(0);
  // expect(service.readSnapshotContent("index.ts")).toBe(`export default 1;
  // `);
});

test.skip("TS: DCE with __PURE__", async () => {
  const code = `
  function f() {
    return 1;
  }
  const x = /*#__PURE__*/ f();
  export {};
  `;
  const { service } = createTestLanguageService(projectPath);
  service.writeSnapshotContent("index.ts", code);
  expect(service.getSemanticDiagnostics("index.ts")).toHaveLength(0);
  expect(service.readSnapshotContent("index.ts")).toEqualFormatted(`
    export {};
  `);
});

test.skip("TS: Inlining with __INLINE__", async () => {
  const code = `
  function f() {
    return 1;
  }
  export const x = /* __INLINE__ */f();
  `;
  const { service } = createTestLanguageService(projectPath);
  service.writeSnapshotContent("index.ts", code);
  expect(service.getSemanticDiagnostics("index.ts")).toHaveLength(0);
  expect(service.readSnapshotContent("index.ts")).toEqualFormatted(`
  export const x = 1;
  `);
});
