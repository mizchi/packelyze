// import { SymbolFlags, isBlock, forEachChild, Node, SourceFile, SyntaxKind, Symbol, TypeChecker, Type, TypeFlags, Program, Block, isSourceFile, isPropertyDeclaration, isClassDeclaration, ClassDeclaration, isMethodDeclaration, VariableStatement, TypeAliasDeclaration, InterfaceDeclaration, FunctionDeclaration, EnumDeclaration, ModuleDeclaration, isVariableStatement, isInterfaceDeclaration, isTypeAliasDeclaration, isFunctionDeclaration, isEnumDeclaration, isModuleDeclaration, NamedDeclaration, VariableDeclaration } from "typescript";
import ts from "typescript";
import { createLogger } from "./logger";

// from typescript: https://github.com/microsoft/TypeScript/blob/d79ec186d6a4e39f57af6143761d453466a32e0c/src/compiler/program.ts#L3384-L3399
export function getNodeAtPosition(
  sourceFile: ts.SourceFile,
  position: number,
): ts.Node {
  let current: ts.Node = sourceFile;
  const getContainingChild = (child: ts.Node) => {
    if (
      child.pos <= position &&
      (position < child.end ||
        (position === child.end && (child.kind === ts.SyntaxKind.EndOfFileToken)))
    ) {
      return child;
    }
  };
  while (true) {
    const child = ts.forEachChild(current, getContainingChild);
    if (!child) {
      return current;
    }
    current = child;
  }
}

export type Visitor = (node: ts.Node, depth?: number) => boolean | void;
export function composeVisitors(...visitors: Visitor[]): Visitor {
  const visit = (node: ts.Node, depth = 0) => {
    for (const visitor of visitors) {
      const ret = visitor(node, depth);
      if (ret === false) {
        break;
      }
    }
    ts.forEachChild(node, (node) => visit(node, depth + 1));
  };
  return visit;
}

type VisitableSignature = ts.PropertySignature | ts.MethodSignature;

export const createVisitSignature = (
  checker: ts.TypeChecker,
  visitor: (symbol: ts.Symbol, property: VisitableSignature) => void,
  debug = false
): Visitor => {
  return (node: ts.Node) => {
    const addNameIfExist = (node: ts.Node) => {
      const name = (node as any)["name"];
      if (name && ts.isIdentifier(name)) {
        const symbol = checker.getSymbolAtLocation(name);
        symbol && visitor(symbol, node as VisitableSignature);
      }
    };
    // if (ts.isPropertyAssignment(node)) {
    //   addNameIfExist(node);
    // }
    if (ts.isPropertySignature(node)) {
      addNameIfExist(node);
    }
    if (ts.isMethodSignature(node)) {
      addNameIfExist(node);
    }
  };
};

export const createVisitScoped = (
  checker: ts.TypeChecker,
  visitor: (symbol: ts.Symbol, decl: TraverseableNode) => void,
  debug = false
): Visitor => {
  return (node: ts.Node) => {
    const addNameIfExist = (node: ts.Node) => {
      const name = (node as any)["name"];
      if (name && ts.isIdentifier(name)) {
        const symbol = checker.getSymbolAtLocation(name);
        symbol && visitor(symbol, node as TraverseableNode);
      }
    };

    if (ts.isFunctionDeclaration(node)) {
      addNameIfExist(node);
    }

    /// Example: const obj = { vvv: 1 };
    // if (ts.isPropertyAssignment(node)) {
    //   addNameIfExist(node);
    // }

    if (ts.isPropertyDeclaration(node)) {
      addNameIfExist(node);
    }

    if (ts.isMethodDeclaration(node)) {
      addNameIfExist(node);
    }

    if (ts.isVariableDeclaration(node)) {
      addNameIfExist(node);
    }
    if (ts.isClassDeclaration(node)) {
      addNameIfExist(node);
    }

    if (ts.isEnumDeclaration(node)) {
      addNameIfExist(node);
    }

    if (ts.isEnumMember(node)) {
      addNameIfExist(node);
    }

    if (ts.isParameter(node)) {
      addNameIfExist(node);
    }
  }
}

export const createVisitScopedName = (
  checker: ts.TypeChecker,
  visitor: (symbol: ts.Identifier, decl: TraverseableNode) => void,
  debug = false
): Visitor => {
  return (node: ts.Node) => {
    const addNameIfExist = (node: ts.Node) => {
      const name = (node as any)["name"];
      if (name && ts.isIdentifier(name)) {
        visitor(name, node as TraverseableNode);
        // const symbol = checker.getSymbolAtLocation(name);
        // symbol && visitor(symbol, node as TraverseableNode);
      }
    };

    if (ts.isFunctionDeclaration(node)) {
      addNameIfExist(node);
    }

    /// Example: const obj = { vvv: 1 };
    if (ts.isPropertyAssignment(node)) {
      addNameIfExist(node);
    }
    
    if (ts.isPropertySignature(node)) {
      addNameIfExist(node);
    }
    if (ts.isMethodSignature(node)) {
      addNameIfExist(node);
    }

    if (ts.isPropertyDeclaration(node)) {
      addNameIfExist(node);
    }
    if (ts.isMethodDeclaration(node)) {
      addNameIfExist(node);
    }

    if (ts.isVariableDeclaration(node)) {
      addNameIfExist(node);
    }
    if (ts.isClassDeclaration(node)) {
      addNameIfExist(node);
    }

    if (ts.isEnumDeclaration(node)) {
      addNameIfExist(node);
    }

    if (ts.isEnumMember(node)) {
      addNameIfExist(node);
    }

    if (ts.isParameter(node)) {
      addNameIfExist(node);
    }
  }
}

export type TraverseableNode =
  | ts.Block
  | ts.ClassDeclaration
  | ts.FunctionDeclaration
  | ts.EnumMember
  // | ts.InterfaceDeclaration
  // | ts.TypeAliasDeclaration
  | ts.EnumDeclaration
  | ts.MethodSignature
  | ts.MethodDeclaration
  | ts.ParameterDeclaration
  | ts.PropertyDeclaration
  | ts.ParameterDeclaration
  // | ts.GetAccessorDeclaration
  // | ts.SetAccessorDeclaration
  | ts.PropertySignature;
/**
 * @internal
 */
// export function visitScopedIdentifierSymbols(
//   program: ts.Program,
//   file: ts.SourceFile,
//   visitor: (symbol: ts.Symbol, parentBlock: TraverseableNode) => void,
//   debug = false
// ): void {
//   // const debugLog = createLogger("[ScopedSymbol]", debug);
//   // const debugLog = createLogger("[ScopedSymbol]", debug);
//   const checker = program.getTypeChecker();
//   const visitScopedIdent = createVisitScopedIdentiferSymbols(checker, (symbol, decl) => {
//     visitor(symbol, decl);
//   }, debug);
//   const composed = composeVisitors(visitScopedIdent);
//   composed(file);
// }

export function findClosestBlock(node: ts.Node) {
  while (node && !ts.isSourceFile(node) && !ts.isBlock(node)) {
    node = node.parent;
  }
  return node;
}

export type AnyExportableDeclaration =
  | ts.VariableStatement
  // | VariableDeclaration
  | ts.InterfaceDeclaration
  | ts.TypeAliasDeclaration
  | ts.ClassDeclaration
  | ts.FunctionDeclaration
  | ts.EnumDeclaration
  | ts.ModuleDeclaration;

export function isExportableDeclaration(
  node: ts.Node,
): node is AnyExportableDeclaration {
  return (
    ts.isVariableStatement(node) ||
    // ts.isVariableDeclaration(node) ||
    ts.isInterfaceDeclaration(node) ||
    ts.isTypeAliasDeclaration(node) ||
    ts.isClassDeclaration(node) ||
    ts.isFunctionDeclaration(node) ||
    ts.isEnumDeclaration(node) ||
    ts.isModuleDeclaration(node)
  );
}

/**
 * find first string matched node in file
 * for testing purpose
 */
export const findFirstNode = (program: ts.Program, fileName: string, matcher: string | RegExp) => {
  const source = program.getSourceFile(fileName);
  if (source) {
    const code = source.getFullText();
    const pos = code.search(matcher);
    if (pos < 0) {
      return;
    }
    const node = getNodeAtPosition(source, pos);
    return node;
  }
}

