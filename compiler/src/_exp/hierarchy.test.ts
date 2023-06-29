import { test, expect } from "vitest";
import ts from "typescript";
import { createOneshotTestProgram, createTestLanguageService } from "../testHarness";

test("incoming internal source", () => {
  const { service, normalizePath } = createTestLanguageService();
  const code = `
  function internal() {
    console.log("internal");
  }
  function foo() {
    internal();
  }
  foo();
  export {}
  `;
  service.writeSnapshotContent(normalizePath("src/index.ts"), code);

  const program = service.getProgram()!;

  const file = program.getSourceFile(normalizePath("src/index.ts"))!;

  // About foo()
  const fooPos = file.getText().search("foo()");
  const incoming = service.provideCallHierarchyIncomingCalls(normalizePath("src/index.ts"), fooPos);
  expect(incoming[0].from.kind, "Called from module").toContain("module");
  const incomingFromSpan = incoming[0].fromSpans[0];
  const incomingCode = file
    .getFullText()
    .slice(incomingFromSpan.start, incomingFromSpan.start + incomingFromSpan.length);
  expect(incomingCode, "Incoming from is self ref").toBe("foo");
  const outcoming = service.provideCallHierarchyOutgoingCalls(normalizePath("src/index.ts"), fooPos);
  // console.log(outcoming[0]);
  expect(outcoming[0].to.kind, "Called from function").toContain("function");
  const outcomingToSpan = outcoming[0].to.span;
  const outcomingCode = file.getFullText().slice(outcomingToSpan.start, outcomingToSpan.start + outcomingToSpan.length);
  // console.log(outcomingCode);
});
