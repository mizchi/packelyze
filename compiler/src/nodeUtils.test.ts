import { Symbol } from "typescript";
import { expect, test } from "vitest";
import { createTestLanguageService } from "./testHarness";
import { visitLocalBlockScopeSymbols } from "./nodeUtils";

test("visitLocalScoped", () => {
  const { service, normalizePath, snapshotManager } = createTestLanguageService();
  snapshotManager.writeFileSnapshot(
    normalizePath("src/index.ts"),
    `
export const exported = 1;
const local = 1;
function fff(arg) {}
{
  const nested = 2;

  class Class {
    v = 1;
    constructor () {
      const cstrInternal = 1;
    }
    method () {
      const internal = 1;
    }
  }
}
`
  );
  const symbols: Symbol[] = [];
  visitLocalBlockScopeSymbols(
    service.getProgram()!,
    service.getProgram()!.getSourceFile(normalizePath("src/index.ts"))!,
    (symbol, parentBlock, paths, depth) => {
      symbols.push(symbol);
    }
  );
  // console.log(symbols.map(s => s.name));
  expect(symbols.map(s => s.name)).toEqual([
    "exported", "local", "fff", "arg", "nested", "Class", "v",  "method", "cstrInternal", "internal"
  ]);
});
