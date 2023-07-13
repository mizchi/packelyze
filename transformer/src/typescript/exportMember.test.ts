import "../../test/globals";
import path from "node:path";
import { expect, test } from "vitest";
import { createTestLanguageService } from "../../test/testHarness";

const projectPath = path.join(__dirname, "../../fixtures/minimum-unused");

test("TS: getExportsOfModule", async () => {
  const indexCode = `
  const x = 1;
  `;
  const subCode = `
  export const sub = 1;
  export type Foo = number;
  export type Bar = Foo;
  `;

  const { service } = createTestLanguageService(projectPath);
  const checker = service.getProgram()?.getTypeChecker();

  service.writeSnapshotContent("index.ts", indexCode);
  service.writeSnapshotContent("sub.ts", subCode);

  const file = service.getProgram()?.getSourceFile("index.ts")!;
  const fileSymbol = checker?.getSymbolAtLocation(file);
  expect(fileSymbol).toBe(undefined);

  const subFile = service.getProgram()?.getSourceFile("sub.ts")!;
  const subFileSymbol = checker?.getSymbolAtLocation(subFile);
  expect(subFileSymbol).toBeDefined();
  expect(checker?.getExportsOfModule(subFileSymbol!).map((s) => s.getName())).toEqual(["sub", "Foo", "Bar"]);
});
