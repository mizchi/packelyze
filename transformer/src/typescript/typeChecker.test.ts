import ts from "typescript";
import "../../test/globals";
import path from "node:path";
import { expect, test } from "vitest";
import { createTestLanguageService } from "../../test/testHarness";

const projectPath = path.join(__dirname, "../../fixtures/minimum-unused");

test("TS: typeChecker.getExportsOfModule", async () => {
  const indexCode = `
  const x = 1;
  `;
  const subCode = `
  export type { Nested } from "./nested";
  export const sub = 1;
  export type Foo = number;
  export type Bar = Foo;
  `;
  const nestedCode = `
  export type Nested = Foo;
  `;

  const { service } = createTestLanguageService(projectPath);
  const checker = service.getProgram()?.getTypeChecker()!;

  service.writeSnapshotContent("index.ts", indexCode);
  service.writeSnapshotContent("sub.ts", subCode);
  service.writeSnapshotContent("nested.ts", nestedCode);

  const file = service.getProgram()?.getSourceFile("index.ts")!;
  const fileSymbol = checker?.getSymbolAtLocation(file);
  expect(fileSymbol).toBe(undefined);

  const subFile = service.getProgram()?.getSourceFile("sub.ts")!;
  const subFileSymbol = checker?.getSymbolAtLocation(subFile);
  expect(subFileSymbol).toBeDefined();
  const symbols = checker.getExportsOfModule(subFileSymbol!).map((s) => {
    const declKind = s.declarations?.[0]!.kind as any;
    return ts.SyntaxKind[declKind] + ":" + s.getName();
  });
  expect(symbols).toEqual([
    "ExportSpecifier:Nested",
    "VariableDeclaration:sub",
    "TypeAliasDeclaration:Foo",
    "TypeAliasDeclaration:Bar",
  ]);
});
