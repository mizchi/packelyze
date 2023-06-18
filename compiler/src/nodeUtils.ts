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

/**
 * Traverse type and call visitor function for each type.
 */
let cachedPrimitiveVisited: Set<ts.Type> | undefined;
let cachedPrimitiveSymbols: Set<ts.Symbol> | undefined;
export function createTypeVisitor(checker: ts.TypeChecker, debug = false) {
  const debugLog = createLogger("[TypeVisit]", debug);
  // const visitedDeclarations = new Set<ts.Declaration>();
  const visitor = (node: ts.Type, visitType: (type: ts.Type) => boolean | void, visitSymbol: (symbol: ts.Symbol) => void, onRevisit?: (type: ts.Type) => boolean | void ) => {
    const visitedTypes = cachedPrimitiveVisited ? new Set(cachedPrimitiveVisited) : new Set<ts.Type>();
    const visitedSymbols = cachedPrimitiveSymbols ? new Set(cachedPrimitiveSymbols) : new Set<ts.Symbol>();

    const visitSymbolWithCache = (symbol: ts.Symbol) => {
      if (visitedSymbols.has(symbol)) return true;
      visitedSymbols.add(symbol);
      visitSymbol(symbol);
    }
    // TODO: need symbol cache?
    return traverse(node, 0);

    function traverse(type: ts.Type, depth = 0, force = false) {
      // check revisted
      if (visitedTypes.has(type) && !force) {
        debugLog("  ".repeat(depth), "(cached)", checker.typeToString(type));
        const again = onRevisit?.(type);
        if (again) {
          traverse(type, depth, true);
        }
        return;
      }

      // mark visited
      visitedTypes.add(type);

      // cache symbols
      if (type.symbol) {
        if (visitSymbolWithCache(type.symbol)) return;
      }
      // check manual stop
      if (visitType(type) === true) {
        debugLog("  ".repeat(depth), "[Stopped]", checker.typeToString(type));
        return;
      }

      const typeString = checker.typeToString(type);
      // const {checker: _, ...rest} = type;
      debugLog(
        "  ".repeat(depth),
        "[Type]",
        typeString,
        {
          ...type,
          checker: undefined,
        },
        // strip
        // type.aliasSymbol && type.aliasSymbol.name,
      );
      // type a = ts.Type

      if (type.flags & ts.TypeFlags.NumberLiteral) {
        return;
      }

      if (type.aliasSymbol) {
        if (visitSymbolWithCache(type.aliasSymbol)) return;
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
        if (visitSymbolWithCache(property)) continue;
        debugLog("  ".repeat(depth + 1), "[Property]", property.name);
        traverse(propertyType, depth + 2);
      };

      // TODO: Handle pattern?
      // if (type.pattern) {
      // }

      for (const signature of checker.getSignaturesOfType(type, ts.SignatureKind.Call)) {
        debugLog("  ".repeat(depth), "[CallSignature]");
        const nextDebug = debug;
        for (const param of signature.parameters) {
          if (param.valueDeclaration) {
            const paramType = checker.getTypeOfSymbolAtLocation(param, param.valueDeclaration);
            if (visitSymbolWithCache(param)) continue;
            debugLog("  ".repeat(depth + 1), "[Parameter]", param.name, checker.typeToString(paramType));
            traverse(paramType, depth + 2, nextDebug);
          }
        }
        if (signature.typeParameters) {
          for (const typeParam of signature.typeParameters) {
            debugLog("  ".repeat(depth + 1), "[TypeParameter]", checker.typeToString(typeParam));
            // const typeParamType = checker.getTypeOfSymbolAtLocation(typeParam, typeParam.valueDeclaration!);
            traverse(typeParam, depth + 2, nextDebug);
          }
        }
        const returnType = checker.getReturnTypeOfSignature(signature);
        debugLog("  ".repeat(depth + 1), "[ReturnType]", checker.typeToString(returnType));
        traverse(returnType, depth + 2, nextDebug);
      }
    }
  };

  if (!cachedPrimitiveVisited) {
    const primitives: ts.Type[] = [
      checker.getNumberType(),
      checker.getStringType(),
      checker.getBooleanType(),
      checker.getUndefinedType(),
      checker.getNullType(),
      checker.getVoidType(),
      checker.getAnyType(),
      checker.getNeverType(),
      checker.getBigIntType(),
      checker.getESSymbolType(),
    ];
    debugLog.off();
    let visitedTypes = new Set<ts.Type>();
    let visitedSymbols = new Set<ts.Symbol>();

    for (const prim of primitives) {
      visitor(prim,
        (type) => {
          visitedTypes.add(type);
        },
        (symbol) => {
          visitedSymbols.add(symbol);
        }
      );
    }
    cachedPrimitiveVisited = visitedTypes;
    cachedPrimitiveSymbols = visitedSymbols;
    if (debug) debugLog.on();
  }

  // console.log("[precache primitives]", visitedTypes.size, visitedSymbols.size, visitedDeclarations.size);
  return visitor;
}

/**
 * Traverse type and call visitor function for each type.
 */
export function createTypeVisitor2(checker: ts.TypeChecker, debug = false) {
  const debugLog = createLogger("[TypeVisit]", debug);
  // const visitedDeclarations = new Set<ts.Declaration>();
  const visitor = (
    node: ts.Node,
    visit: (decl: ts.Node) => void,
  //   visitType: (type: ts.Type) => boolean | void,
  //   visitSymbol: (symbol: ts.Symbol) => void,
  //   onRevisit?: (type: ts.Type) => boolean | void
  ) => {
    const visitedTypes = new Set<ts.Type>();
    const visitedSymbols = new Set<ts.Symbol>();
    const visitedDeclarations = new Set<ts.Node>();

    const visitNodeWithCache = (decl: ts.Node) => {
      if (visitedDeclarations.has(decl)) return;
      visitedDeclarations.add(decl);
      visit(decl);
      if (decl.parent) {
        const symbol = checker.getSymbolAtLocation(decl);
        if (symbol) {
          visitSymbolWithCache(symbol);
        }  
      }
      // if (ts.isTypeAliasDeclaration(decl)) {
      //   for (const typeParam of decl.typeParameters ?? []) {
      //     visitNodeWithCache(typeParam);
      //   }
      //   if (decl.type) {
      //     const type = checker.getTypeFromTypeNode(decl.type);
      //     visitSymbolWithCache(type.symbol!);
      //   }
      // }
      // if (ts.isInterfaceDeclaration(decl)) {
      //   for (const typeParam of decl.typeParameters ?? []) {
      //     visitNodeWithCache(typeParam);
      //   }
      //   for (const member of decl.members) {
      //     visitNodeWithCache(member);
      //   }
      // }
      ts.forEachChild(decl, (node) => visitNodeWithCache(node));
    }

    const visitSymbolWithCache = (symbol: ts.Symbol) => {
      if (visitedSymbols.has(symbol)) return true;
      visitedSymbols.add(symbol);
      traverse(checker.getDeclaredTypeOfSymbol(symbol), 0);
      for (const decl of symbol.declarations ?? []) {
        visitNodeWithCache(decl);
      }
      if (symbol.valueDeclaration) {
        visitNodeWithCache(symbol.valueDeclaration);
      }
    }
    return visitNodeWithCache(node);
    // return traverse(node, 0);

    function traverse(type: ts.Type, depth = 0, force = false) {
      // check revisted
      if (visitedTypes.has(type) && !force) {
        debugLog("  ".repeat(depth), "(cached)", checker.typeToString(type));
        return;
      }
      // mark visited
      visitedTypes.add(type);
      // cache symbols
      if (type.symbol) {
        if (visitSymbolWithCache(type.symbol)) return;
      }
      // check manual stop
      const typeString = checker.typeToString(type);
      // const {checker: _, ...rest} = type;
      debugLog(
        "  ".repeat(depth),
        "[Type]",
        typeString,
        {
          ...type,
          checker: undefined,
        },
        // strip
        // type.aliasSymbol && type.aliasSymbol.name,
      );
      // type a = ts.Type

      // if (type.flags & ts.TypeFlags.NumberLiteral) {
      //   return;
      // }

      if (type.aliasSymbol) {
        if (visitSymbolWithCache(type.aliasSymbol)) return;
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
        if (visitSymbolWithCache(property)) continue;
        debugLog("  ".repeat(depth + 1), "[Property]", property.name);
        const propertyType = checker.getTypeOfSymbolAtLocation(property, property.valueDeclaration);
        traverse(propertyType, depth + 2);
      };

      // TODO: Handle pattern?
      // if (type.pattern) {
      // }

      for (const signature of checker.getSignaturesOfType(type, ts.SignatureKind.Call)) {
        debugLog("  ".repeat(depth), "[CallSignature]");
        const nextDebug = debug;
        for (const param of signature.parameters) {
          if (param.valueDeclaration) {
            const paramType = checker.getTypeOfSymbolAtLocation(param, param.valueDeclaration);
            if (visitSymbolWithCache(param)) continue;
            debugLog("  ".repeat(depth + 1), "[Parameter]", param.name, checker.typeToString(paramType));
            traverse(paramType, depth + 2, nextDebug);
          }
        }
        if (signature.typeParameters) {
          for (const typeParam of signature.typeParameters) {
            debugLog("  ".repeat(depth + 1), "[TypeParameter]", checker.typeToString(typeParam));
            // const typeParamType = checker.getTypeOfSymbolAtLocation(typeParam, typeParam.valueDeclaration!);
            traverse(typeParam, depth + 2, nextDebug);
          }
        }
        const returnType = checker.getReturnTypeOfSignature(signature);
        debugLog("  ".repeat(depth + 1), "[ReturnType]", checker.typeToString(returnType));
        traverse(returnType, depth + 2, nextDebug);
      }
    }
  };
  // console.log("[precache primitives]", visitedTypes.size, visitedSymbols.size, visitedDeclarations.size);
  return visitor;
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

