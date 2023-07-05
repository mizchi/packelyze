import "../__vitestUtils";
import { initTestLanguageServiceWithFiles } from "../testHarness";
import { RenameItem, collectRenameItems, getRenameAppliedChanges } from "./renamer";
import { createSymbolBuilder } from "../symbolBuilder";
import { expect, test } from "vitest";
import { findExportedNodesFromRoot, findMangleNodes, getRenameActionsFromMangleNode } from "./mangler";

function mangleFiles(files: Record<string, string>, entry: string, targets?: string[]) {
  const { service, normalizePath } = initTestLanguageServiceWithFiles(files);
  targets = (targets ?? Object.keys(files)).map(normalizePath);
  entry = normalizePath(entry);

  const checker = service.getProgram()!.getTypeChecker();
  const root = service.getCurrentSourceFile(entry)!;
  const exportedNodes = findExportedNodesFromRoot(checker, root);

  const symbolBuilder = createSymbolBuilder();
  const items: RenameItem[] = targets.flatMap((target) => {
    symbolBuilder.reset();
    const file = service.getCurrentSourceFile(target)!;
    const nodes = findMangleNodes(checker, file, exportedNodes);
    // console.log("renaming", target, nodes.size);
    return [...nodes].flatMap((node) => {
      const action = getRenameActionsFromMangleNode(checker, symbolBuilder, node);
      return collectRenameItems(service, file, action.start, action.original, action.to) ?? [];
    });
  });

  return getRenameAppliedChanges(items, service.readSnapshotContent, normalizePath);
}

test("mangle", () => {
  const nextContents = mangleFiles(
    {
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
    },
    "src/index.ts",
  );
  const indexResult = nextContents[0].content;
  expect(indexResult).toEqualFormatted(`
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

// type SubLocal = {
//   subLocal: number;
// };

// export const sub: SubLocal = {
//   subLocal: 1,
// };

test("mangle: multi files", () => {
  const newState = mangleFiles(
    {
      "src/sub.ts": `
      type SubLocal = {
        subLocal: number;
      }
      const vvv = 1;
      export const sub: SubLocal = {
        subLocal: 1
      };
    `,
      "src/index.ts": `
      import { sub } from "./sub";
      const indexLocal = 1;
      export const x = sub.subLocal;
      `,
    },
    "src/index.ts",
  );
  // const files = [...newState.values()].map((m) => m[0]);
  // console.log(newState);
  const subResult = newState[0].content;
  const indexResult = newState[1].content;

  expect(subResult).toEqualFormatted(`
  type SubLocal = {
    k: number;
  };
  const x = 1;
  export const sub: SubLocal = {
    k: 1,
  };
  `);
  expect(indexResult).toEqualFormatted(`
  import { sub } from "./sub";
  const k = 1;
  export const x = sub.k;
  `);

  // type SubLocal = {
  //   k: number;
  // };
  // const x = 1;
  // export const sub: SubLocal = {
  //   k: 1,
  // };
  // `);
  // expect(newState.size).toBe(2);
  // expect([...newState.values()].map((x) => x[0])).toEqual(["src/sub.ts", "src/index.ts"]);

  // expect([...newState.values()]).toEqual(

  //       "src/sub.ts",
  //       [

  // )
  // const indexResult = [...newState][0][1][0];
  // expect(indexResult).toEqualFormatted(`
  // type Local = {
  //   k: number;
  // };
  // type Pub = {
  //   pub: number;
  // };
  // function j(): Pub {
  //   const q: Local = { k: 1 };
  //   return {
  //     pub: q.k,
  //   };
  // }
  // export const x = j();
  // `);
});

test("rename local object member", () => {
  const { service, normalizePath } = initTestLanguageServiceWithFiles({
    "src/index.ts": `
    type Local = {
      xxx: number;
    }; 
    type Pub = {
      pubv: number;
    };
    const loc: Local = { xxx: 1 };
    const pub: Pub = { pubv: 1 };
    export { pub };  
    `,
  });
  const file = service.getCurrentSourceFile("src/index.ts")!;
  const checker = service.getProgram()!.getTypeChecker();

  const exportedNodes = findExportedNodesFromRoot(checker, file);
  const nodes = findMangleNodes(checker, file, exportedNodes);
  const symbolBuilder = createSymbolBuilder();

  // const item
  const items: RenameItem[] = [...nodes].flatMap((node) => {
    const action = getRenameActionsFromMangleNode(checker, symbolBuilder, node);
    const renames = collectRenameItems(service, file, action.start, action.original, action.to);
    return renames ?? [];
  });

  const newState = getRenameAppliedChanges(items, service.readSnapshotContent, normalizePath);
  for (const content of newState) {
    // const [changed, changedStart, changedEnd] = content;
    service.writeSnapshotContent(content.fileName, content.content);
  }
  const newFile = service.getCurrentSourceFile(normalizePath("src/index.ts"))!;
  const result = newFile.getText();

  expect(result).toEqualFormatted(`
  type Local = {
    k: number;
  };
  type Pub = {
    pubv: number;
  };
  const x: Local = { k: 1 };
  const j: Pub = { pubv: 1 };
  export { j as pub };
  `);
});
