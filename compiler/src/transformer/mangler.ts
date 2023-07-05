import "../__vitestUtils";
import ts from "typescript";
import { getLocalBindings } from "../analyzer/scope";
// import { collectDeclarations, isVisitableNode } from "../analyzer/nodeWalker";
import { VisitedCache, createGetSymbolWalker } from "../analyzer/symbolWalker";
import { createOneshotTestProgram, createTestLanguageService } from "../testHarness";
import { RenameItem, RenameSourceKind, RenameTargetKind, collectRenameItems, getRenameAppliedState } from "./renamer";
import { createSymbolBuilder } from "../symbolBuilder";
import prettier from "prettier";
import { toReadableNode, toReadableSymbol, toReadableType } from "../nodeUtils";
import { collectDeclarations } from "../analyzer/nodeWalker";

// type VisitableNode =
//   | ts.TypeLiteralNode
//   | ts.PropertySignature
//   | ts.MethodSignature
//   | ts.ParameterDeclaration
//   | ts.TypeNode
//   | ts.GetAccessorDeclaration
//   | ts.SetAccessorDeclaration;

// function isVisitableNode(node: ts.Node): node is VisitableNode {
//   return (
//     ts.isTypeNode(node) ||
//     ts.isTypeLiteralNode(node) ||
//     ts.isPropertySignature(node) ||
//     ts.isMethodSignature(node) ||
//     ts.isParameter(node) ||
//     ts.isGetAccessor(node) ||
//     ts.isSetAccessor(node)
//   );
// }

// function collectDeclarations(visited: VisitedCache, debug: boolean = false) {
//   const log = debug ? console.log : () => {};
//   const visitedNodes = new Set<ts.Node>();
//   for (const symbol of visited.visitedSymbols) {
//     for (const declaration of symbol.getDeclarations() ?? []) {
//       visitNode(declaration, 0);
//     }
//   }
//   return visitedNodes;

//   function visitNode(node: ts.Node, depth: number) {
//     log("  ".repeat(depth) + "[Node:" + ts.SyntaxKind[node.kind] + "]", node.getText().slice(0, 10) + "...");

//     if (!isVisitableNode(node)) return;
//     if (visitedNodes.has(node)) return;
//     visitedNodes.add(node);

//     if (ts.isTypeNode(node)) {
//       // const type = checker.getTypeFromTypeNode(node);
//       // visitType(type, depth + 1);
//     }

//     if (ts.isParameter(node)) {
//       if (node.type) {
//         visitNode(node.type, depth + 1);
//       }
//     }

//     if (ts.isPropertyAssignment(node)) {
//       visitNode(node, depth + 1);
//       // if (node.name) {
//       //   visitNode(node.name, depth + 1);
//       // }
//     }

//     if (ts.isPropertySignature(node)) {
//       if (node.type) {
//         visitNode(node.type, depth + 1);
//       }
//     }
//     if (ts.isMethodSignature(node)) {
//       for (const param of node.parameters) {
//         visitNode(param, depth + 1);
//       }
//     }
//     if (ts.isGetAccessor(node)) {
//       for (const param of node.parameters) {
//         visitNode(param, depth + 1);
//       }
//     }
//     if (ts.isSetAccessor(node)) {
//       for (const param of node.parameters) {
//         visitNode(param, depth + 1);
//       }
//     }
//   }
// }

export function findManglableNodes(checker: ts.TypeChecker, file: ts.SourceFile) {
  const symbolWalker = createGetSymbolWalker(checker)();
  const exports = checker.getExportsOfModule(checker.getSymbolAtLocation(file)!);
  for (const exported of exports) {
    symbolWalker.walkSymbol(exported);
  }
  const visited = symbolWalker.getVisited();
  const exportedNodes = collectDeclarations(visited);
  const bindingIdentifiers = getLocalBindings(file);
  // console.log(
  //   "[exported]",
  //   [...exportedNodes].map((x) => toReadableNode(x)),
  // );
  // console.log(
  //   "[bindings]",
  //   bindingIdentifiers.map((x) => toReadableNode(x, 0)),
  // );
  const manglables = new Set<ts.Node>();
  for (const identifier of bindingIdentifiers) {
    const symbol = checker.getSymbolAtLocation(identifier)!;
    if (exportedNodes.has(identifier.parent)) {
      // console.log("[skip exported]", identifier.getText());
      continue;
    }
    if (symbol && exports.includes(symbol)) continue;
    manglables.add(identifier);
  }
  return manglables;
}

{
  type Local = {
    local: number;
  };
  type Pub = {
    pub: number;
  };

  function fff(): Pub {
    const local: Local = { local: 1 };
    return {
      pub: local.local,
    };
  }
  const x = fff();
}

if (import.meta.vitest) {
  const { test, expect } = import.meta.vitest;

  test("scoped variables", () => {
    const { service, normalizePath } = createTestLanguageService();
    const code = `
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
    `;
    service.writeSnapshotContent(normalizePath("src/index.ts"), code);
    const file = service.getCurrentSourceFile(normalizePath("src/index.ts"))!;

    const checker = service.getProgram()!.getTypeChecker();

    const nodes = findManglableNodes(checker, file);
    expect([...nodes].map((x) => x.getText())).toEqualSet(["local", "Pub", "Local", "fff", "fLocal"]);

    const items: RenameItem[] = [];
    const symbolBuilder = createSymbolBuilder();
    for (const node of nodes) {
      const newName = symbolBuilder.create();
      const renames = collectRenameItems(
        service,
        file,
        node.pos,
        RenameSourceKind.ScopedIdentifier,
        node.getText(),
        newName,
        {
          allowTextChangesInNewFiles: true,
        },
      );

      if (renames) {
        items.push(...renames);
      }
    }
    const newState = getRenameAppliedState(items, service.readSnapshotContent, normalizePath);
    for (const [fname, content] of newState) {
      const [changed, changedStart, changedEnd] = content;
      service.writeSnapshotContent(fname, changed);
    }
    const newFile = service.getCurrentSourceFile(normalizePath("src/index.ts"))!;
    // console.log("[changed]\n" + newFile.getText());
    // TODO: rename local
    expect(prettier.format(newFile.getText(), { parser: "typescript" })).toBe(`type k = {
  local: number;
};
type j = {
  pub: number;
};

function q(): j {
  const z: k = { local: 1 };
  return {
    pub: z.local,
  };
}
export const x = q();
`);
    // const renames = collectRenameItems(checker, file, nodes);
    // expect(nodes.map((x) => x.name)).toEqualSet(["local", "Pub"]);
  });
}
