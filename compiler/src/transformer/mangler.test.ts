import "../__vitestUtils";
import ts from "typescript";
import { initTestLanguageServiceWithFiles } from "../testHarness";
import { RenameItem, collectRenameItems, getRenameAppliedState } from "./renamer";
import { createSymbolBuilder } from "../symbolBuilder";
import { expect, test } from "vitest";
import { findMangleNodes, getRenameActionsFromMangleNode } from "./mangler";

test("scoped variables", () => {
  const { service, normalizePath } = initTestLanguageServiceWithFiles({
    "src/index.ts": `
      type Local = {
        local: number;
      }
      type Pub = {
        pub: number;
      }
      function fff(): Pub {
        const fLocal: Local = {local: 1};
        return {
          pub: fLocal.local
        }
      }
      export const x = fff();
      `,
  });

  const file = service.getCurrentSourceFile("src/index.ts")!;
  const checker = service.getProgram()!.getTypeChecker();
  const nodes = findMangleNodes(checker, file);
  expect([...nodes].map((x) => x.getText())).toEqualSet(["local", "Pub", "Local", "fff", "fLocal"]);
  const symbolBuilder = createSymbolBuilder();

  // const item
  const items: RenameItem[] = [...nodes].flatMap((node) => {
    const action = getRenameActionsFromMangleNode(checker, symbolBuilder, node);
    const renames = collectRenameItems(service, file, action.start, action.original, action.to);
    return renames ?? [];
  });

  const newState = getRenameAppliedState(items, service.readSnapshotContent, normalizePath);
  for (const [fname, content] of newState) {
    const [changed, changedStart, changedEnd] = content;
    service.writeSnapshotContent(fname, changed);
  }
  const newFile = service.getCurrentSourceFile(normalizePath("src/index.ts"))!;
  expect(newFile.getText()).toEqualFormatted(`
  type Local = {
    k: number;
  };
  type Pub = {
    pub: number;
  };
  function j(): Pub {
    const q: Local = { k: 1 };
    return {
      pub: q.k,
    };
  }
  export const x = j();
  `);
});
