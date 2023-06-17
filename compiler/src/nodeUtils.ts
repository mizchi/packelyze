// import { SymbolFlags, isBlock, forEachChild, Node, SourceFile, SyntaxKind, Symbol, TypeChecker, Type, TypeFlags, Program, Block, isSourceFile, isPropertyDeclaration, isClassDeclaration, ClassDeclaration, isMethodDeclaration, VariableStatement, TypeAliasDeclaration, InterfaceDeclaration, FunctionDeclaration, EnumDeclaration, ModuleDeclaration, isVariableStatement, isInterfaceDeclaration, isTypeAliasDeclaration, isFunctionDeclaration, isEnumDeclaration, isModuleDeclaration, NamedDeclaration, VariableDeclaration } from "typescript";
import ts from "typescript";

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

/**
 * Traverse type and call visitor function for each type.
 */
export function createTypeVisitor(checker: ts.TypeChecker, debug = false) {
  const debugLog = debug ? console.log : () => {};

  return (node: ts.Type, visitor: (type: ts.Type) => boolean | void, onRevisit?: (type: ts.Type) => boolean | void ) => {
    const visitedTypes = new Set<ts.Type>();
    // TODO: need symbol cache?
    return traverse(node, 0);

    function traverse(type: ts.Type, depth = 0, force = false) {
      if (visitedTypes.has(type) && !force) {
        debugLog("  ".repeat(depth), "[Revisit]", checker.typeToString(type));
        const again = onRevisit?.(type);
        if (again) {
          traverse(type, depth, true);
        }
        return;
      }
      if (visitor(type) === true) {
        debugLog("  ".repeat(depth), "[Stopped]", checker.typeToString(type));
        return;
      }

      const typeString = checker.typeToString(type);
      debugLog(
        "  ".repeat(depth),
        "[Type]",
        typeString,
      );
  
      if (type.flags & ts.TypeFlags.NumberLiteral) {
        return;
      }
      if (typeString.startsWith('"')) {
        return;
      }
      if (type.aliasSymbol) {
        const aliasType = checker.getDeclaredTypeOfSymbol(type.aliasSymbol);
        traverse(aliasType, depth + 1);
      }
      if (type.aliasTypeArguments) {
        for (const typeArg of type.aliasTypeArguments) {
          traverse(typeArg);
        }
      }
      if (type.isUnion()) {
        for (const t of type.types) {
          debugLog("  ".repeat(depth + 1), "[Union]");
          traverse(t, depth + 1);
        }
      }
      if (type.isIntersection()) {
        for (const t of type.types) {
          debugLog("  ".repeat(depth + 1), "[Intersection]");
          traverse(t, depth + 1);
        }
      }
      for (const property of type.getProperties()) {
        if (property.valueDeclaration == null) {
          // TODO
          continue;
        }
        const propertyType = checker.getTypeOfSymbolAtLocation(property, property.valueDeclaration);
        debugLog("  ".repeat(depth + 1), "[Property]", property.name);
        traverse(propertyType, depth + 2);
      };

      if (type.pattern) {
      // TODO: Handle pattern?
        // type.pattern
      }
    }
  };
}

export type TraverseableNode = ts.Block | ts.ClassDeclaration | ts.FunctionDeclaration | ts.InterfaceDeclaration | ts.TypeAliasDeclaration | ts.EnumDeclaration | ts.ModuleDeclaration | ts.SourceFile;
/**
 * @internal
 */
export function visitLocalBlockScopeSymbols(
  program: ts.Program,
  file: ts.SourceFile,
  visitor: (symbol: ts.Symbol, parentBlock: TraverseableNode, paths: Array<TraverseableNode>, depth: number) => void,
  depth = 0, 
  debug = false
): void {
  const debugLog = debug ? console.log : () => { };
  const checker = program.getTypeChecker();

  const visit = (node: ts.Node, blockPaths: ts.Block[], depth: number = 0) => {
    if (ts.isFunctionDeclaration(node)) {
      if (node.name) {
        const symbol = checker.getSymbolAtLocation(node.name);
        if (symbol) {
          visitor(symbol, node, blockPaths, depth);
        }
      }
      for (const param of node.parameters) {
        const symbol = checker.getSymbolAtLocation(param.name);
        if (symbol) {
          visitor(symbol, node, blockPaths, depth);
        }
      }
    }

    if (ts.isClassDeclaration(node)) {
      for (const member of node.members) {
        if (ts.isPropertyDeclaration(member)) {
          const symbol = checker.getSymbolAtLocation(member.name);
          if (symbol) {
            visitor(symbol, node, blockPaths, depth);
          }
        }
        if (ts.isMethodDeclaration(member)) {
          const symbol = checker.getSymbolAtLocation(member.name);
          if (symbol) {
            visitor(symbol, node, blockPaths, depth);
          }
        }
      }
    }

    // if (isEnumDeclaration(node)) {
    //   if (node.name) {
    //     const symbol = checker.getSymbolAtLocation(node.name);
    //     console.log("[nodeUtil:visit]", "enum", node.name?.getText(), symbol?.name);
    //     if (symbol) {
    //       visitor(symbol, node, blockPaths, depth);
    //     }
    //   }
    // }

    if (ts.isSourceFile(node) || ts.isBlock(node)) {
      const newPaths = [...blockPaths, node as ts.Block];
      const scopedSymbols = checker.getSymbolsInScope(node, ts.SymbolFlags.BlockScoped);
      // const scopedSymbols = checker.getSymbolsInScope(node, SymbolFlags.BlockScopedVariable);

      // console.log("[nodeUtil:scopedSymbols]", scopedSymbols.map((s) => s.name));
      const scopedSymbolsInBlock = scopedSymbols.filter((sym) => {
        if (sym.valueDeclaration) {
          const closestBlock = findClosestBlock(sym.valueDeclaration);
          return node === closestBlock;            
        } else {
          for (const decl of sym.declarations ?? []) {
            debugLog("  ".repeat(depth + 1), "[decl]", sym.name, decl.getSourceFile() === file);
            const isLocalBlock = findClosestBlock(decl) === node;
            return decl.getSourceFile() === file && isLocalBlock;
          }
        }
        return false;
      });
      debugLog("  ".repeat(depth), `[block]`, scopedSymbolsInBlock.map((s) => s.name));
      for (const symbol of scopedSymbolsInBlock) {
        const decl = symbol.valueDeclaration;
        debugLog("  ".repeat(depth), `> [block:local]`, symbol.name, "-", decl && ts.SyntaxKind[decl.kind]);
        visitor(symbol, node as ts.Block, newPaths, depth);
      }
      ts.forEachChild(node, (node) => visit(node, newPaths, depth + 1));
    } else {
      ts.forEachChild(node, (node) => visit(node, blockPaths, depth + 1));
    }
  };
  visit(file, [], depth);
}

export function findClosestBlock(node: ts.Node) {
  while (node && !ts.isSourceFile(node) && !ts.isBlock(node)) {
    node = node.parent;
  }
  return node;
}

export function findExportableDeclaration(node: ts.Node): AnyExportableDeclaration | undefined {
  while (node && !ts.isBlock(node) && !ts.isMethodDeclaration(node)) {
    if (isExportableDeclaration(node)) {
      return node;
    }
    node = node.parent;
  }
}

export function isExportedDeclaration(node: ts.Node): boolean {
  const decl = findExportableDeclaration(node);
  return decl?.modifiers?.some((mod) => mod.kind === ts.SyntaxKind.ExportKeyword) ?? false;
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
