// import { Program, Node, SourceFile, FunctionDeclaration, FunctionExpression, isFunctionDeclaration } from "typescript";
// import { Block, ClassDeclaration, FunctionDeclaration, Node, Program, Signature, SourceFile, Symbol, SymbolFlags, Type, isExpression, isFunctionDeclaration, isVariableStatement } from "typescript";
import ts from "typescript";
import { TraverseableNode, createTypeVisitor, createVisitScoped, composeVisitors, createVisitSignature } from "./nodeUtils";
import { createLogger } from "./logger";

export type ScopedSymbol = {
  symbol: ts.Symbol;
  parentBlock: TraverseableNode;
  isExportRelated?: boolean;
}

export function collectScopedSymbols(program: ts.Program, file: ts.SourceFile, externals: string[] = [], debug = false): ScopedSymbol[] {
  const checker = program.getTypeChecker();
  const collector = createRelatedTypesCollector(program, debug);

  const exportSymbols = collectExportSymbols(program, file, debug);
  const globalVariables = collectGlobalVariables(program, file);
  const globalTypes = collectGlobalTypes(program, file);

  // colect export related types
  for (const symbol of exportSymbols) {
    collector.collectRelatedTypesFromSymbol(symbol);
  }

  // colect global vars related types
  for (const symbol of globalVariables) {
    collector.collectRelatedTypesFromSymbol(symbol);
  }
  // colect global related types
  for (const symbol of globalTypes) {
    collector.collectRelatedTypesFromSymbol(symbol);
  }

  // collect external import related types
  if (externals.length > 0) {
    const importable = collectImportableModules(program, file);
    // console.log("importable", importable.length, importable.map((s) => s.name));
    for (const external of externals) {
      const mod = importable.find((s) => s.name === external);
      if (mod) {
        const exportSymbols = checker.getExportsOfModule(mod);
        // console.log("external", external, mod.name, exportSymbols.length);
        for (const symbol of exportSymbols) {
          collector.collectRelatedTypesFromSymbol(symbol);
        }
      }
    }  
  }

  const result: ScopedSymbol[] = [];

  // const checker = program.getTypeChecker();
  const visitScopedIdentifierSymbols = createVisitScoped(checker, (symbol, parentBlock) => {
    if (symbol.valueDeclaration == null) {
      const type = checker.getTypeOfSymbolAtLocation(symbol, symbol.valueDeclaration!);
      const isExportRelated = collector.isRelatedType(type);
      result.push({
        symbol,
        parentBlock,
        isExportRelated,
      });
    } else {
      if (symbol.declarations) {
        for (const decl of symbol.declarations) {
          const type = checker.getTypeOfSymbolAtLocation(symbol, decl);
          const isExportRelated = collector.isRelatedType(type);
          result.push({
            symbol,
            parentBlock,
            isExportRelated,
          });  
        }  
      }
    }
  }, debug);

  composeVisitors(
    visitScopedIdentifierSymbols,
  )(file);
  return result;
}

export function collectScopedSignatures(program: ts.Program, file: ts.SourceFile, externals: string[] = [], debug = false): ScopedSymbol[] {
  const log = createLogger(`[collectScopedSignatures]`,debug);
  log.on();
  const checker = program.getTypeChecker();
  const exportSymbols = collectExportSymbols(program, file, debug);
  const globalVariables = collectGlobalVariables(program, file);
  const globalTypes = collectGlobalTypes(program, file);

  // const collector = createRelatedTypesCollector(program, debug);
  const collector2 = createCollector(checker, debug);

  // colect export related types
  for (const symbol of exportSymbols) {
    // collector.collectRelatedTypesFromSymbol(symbol);
    collector2.visitSymbol(symbol);
  }

  // colect global vars related types
  for (const symbol of globalVariables) {
    // collector.collectRelatedTypesFromSymbol(symbol);
    // collector2.visitSymbol(symbol);
  }
  // colect global related types
  for (const symbol of globalTypes) {
    // collector.collectRelatedTypesFromSymbol(symbol);
    // collector2.visitSymbol(symbol);
  }

  // collect external import related types
  if (externals.length > 0) {
    const importable = collectImportableModules(program, file);
    // console.log("importable", importable.length, importable.map((s) => s.name));
    for (const external of externals) {
      const mod = importable.find((s) => s.name === external);
      if (mod) {
        const exportSymbols = checker.getExportsOfModule(mod);
        // console.log("external", external, mod.name, exportSymbols.length);
        for (const symbol of exportSymbols) {
          // collector.collectRelatedTypesFromSymbol(symbol);
          collector2.visitSymbol(symbol);
        }
      }
    }  
  }

  const result: ScopedSymbol[] = [];

  // const checker = program.getTypeChecker();
  const visitSignature = createVisitSignature(checker, (symbol, parentBlock) => {
    // const isExportRelated = collector.isRelatedSymbol(symbol);
    log("visitSignature", symbol.name);

    // if (!isExportRelated) {
    //   result.push({
    //     symbol,
    //     parentBlock,
    //     isExportRelated,
    //   });
    // }
    if (symbol.valueDeclaration == null) {
      log("visitSignature:valueDeclaration==null", symbol.name);
      // const type = checker.getTypeOfSymbolAtLocation(symbol, symbol.valueDeclaration!);
      // const isExportRelated = collector.isRelatedType(type);
      const isExportRelated = collector2.isRelatedSymbol(symbol);
      if (!isExportRelated) {
        result.push({
          symbol,
          parentBlock,
          isExportRelated,
        });
      }
    } else {
      if (symbol.declarations) {
        for (const decl of symbol.declarations) {
          const isExportRelated = collector2.isRelatedNode(decl);
          // const type = checker.getTypeOfSymbolAtLocation(symbol, decl);
          // const isExportRelated = collector.isRelated(symbol);
          const isRelatedDeclaration = collector2.isRelatedNode(decl);
          if (symbol.name === 'pub') {
            log("visitSignature:declarations", symbol.name, "exported?", isExportRelated, "relatedDeclaration?", isRelatedDeclaration);
            // const d = decl;
            // if (d.getSourceFile().fileName.startsWith(program.getCurrentDirectory())) {
            //   log(d.getSourceFile().fileName.replace(
            //     program.getCurrentDirectory() + '/', ''
            //   ), d.getText());
            // }

            // log("visitSignature:declarations", symbol.name, "exported?", isExportRelated);
            // console.log(decl.getText());

            // const symbols = collector.getRelatedTypes();
            // for (const s of symbols) {
            //   if (s.symbol?.declarations){
            //     for (const d of s.symbol.declarations) {
            //       if (d.getSourceFile().fileName.startsWith(program.getCurrentDirectory())) {
            //         log(d.getSourceFile().fileName.replace(
            //           program.getCurrentDirectory() + '/', ''
            //         ), d.getText());
            //       }
            //     }
            //     // console.log(
            //     //   s.symbol.declarations
            //     //     .filter((d) => d.getSourceFile().fileName.startsWith(program.getCurrentDirectory()))
            //     //   );
            //   }
            //   // console.log(s.symbol);
            // }
          }

          if (!isExportRelated) {
            result.push({
              symbol,
              parentBlock,
              isExportRelated,
            });
          }
        }  
      }
    }
  }, debug);

  composeVisitors(
    visitSignature,
  )(file);
  return result;
}


export function createRelatedTypesCollector(program: ts.Program, debug = false) {
  const checker = program.getTypeChecker();
  // let symbols = new Map<string, Symbol>();
  let relatedTypes = new Set<ts.Type>();
  let relatedSymbols = new Set<ts.Symbol>();
  let relatedDeclarations = new Set<ts.Declaration>();
  const visitType = createTypeVisitor(checker, debug);
  return {
    isRelatedType,
    isRelatedSymbol,
    getRelatedTypes: () => relatedTypes,
    getRelatedSybols: () => relatedSymbols,
    isRelatedDeclaration: (node: ts.Declaration) => {
      return relatedDeclarations.has(node as ts.Declaration);
    },
    isRelated(...symbolOrType: (ts.Type | ts.Symbol | ts.Declaration)[]) {
      return symbolOrType.some((s) => {
        if (s.flags & ts.SymbolFlags.Type) {
          return relatedTypes.has(s as ts.Type);
        } else {
          return isRelatedSymbol(s as ts.Symbol);
        }
      })
    },
    collectRelatedType,
    collectRelatedTypesFromSymbol: (symbol: ts.Symbol, depth = 0) => {
      const types = symbolToRelatedTypes(symbol, checker);
      if (symbol.valueDeclaration) {
        relatedDeclarations.add(symbol.valueDeclaration);
      }
      for (const type of types) {
        collectRelatedType(type, depth);
      }
    },
  }

  function isRelatedType(type: ts.Type) {
    return relatedTypes.has(type)
  };
  function isRelatedSymbol(symbol: ts.Symbol) {
    if (symbol.valueDeclaration) {
      const type = checker.getTypeOfSymbolAtLocation(symbol, symbol.valueDeclaration);
      return relatedTypes.has(type);
    }
    return relatedSymbols.has(symbol);
  }

  function collectRelatedType(type: ts.Type, depth = 0) {
    visitType(
      type,
      (type) => {
        if (relatedTypes.has(type)) {
          return true;
        }
        relatedTypes.add(type);
      },
      (symbol) => {
        if (relatedSymbols.has(symbol)) {
          return true;
        }
      }
    );
    return;
  }
}

export function collectExportSymbols(program: ts.Program, source: ts.SourceFile, debug = false): ts.Symbol[] {
  const checker = program.getTypeChecker();
  const symbol = checker.getSymbolAtLocation(source);
  const exportSymbols = checker.getExportsOfModule(symbol!);
  return exportSymbols;
}

export function collectImportableModules(program: ts.Program, file: ts.SourceFile) {
  const checker = program.getTypeChecker();
  const values = checker.getSymbolsInScope(file, ts.SymbolFlags.ValueModule);
  return values;  
}

export function collectGlobalVariables(program: ts.Program, file: ts.SourceFile) {
  const checker = program.getTypeChecker();
  const scopedSymbols =  new Set(checker.getSymbolsInScope(file, ts.SymbolFlags.BlockScoped));

  const variables = checker.getSymbolsInScope(file, ts.SymbolFlags.Variable).filter((s) => {
    return !scopedSymbols.has(s);
  });
  return variables;
}

export function collectGlobalTypes(program: ts.Program, file: ts.SourceFile) {
  const checker = program.getTypeChecker();
  const types = checker.getSymbolsInScope(file, ts.SymbolFlags.Type).filter((s) => {
    if (s.declarations) {
      for (const decl of s.declarations) {
        if (decl.getSourceFile() === file) {
          return false;
        }
      }
    }
    return s.valueDeclaration == null;
  });
  return types;
}

// collect unsafe rename targets
/** @internal */
export function collectUnsafeRenameTargets(program: ts.Program, source: ts.SourceFile, scopedSymbols: ScopedSymbol[]) {
  const checker = program.getTypeChecker();
  const unsafeRenameTargets = new Set<string>();
  // register global names to unsafe
  for (const gvar of collectGlobalVariables(program, source)) {
    unsafeRenameTargets.add(gvar.name);
  }
  // register existed local names to unsafe
  for (const blockSymbol of scopedSymbols) {
    const symbols = checker.getSymbolsInScope(blockSymbol.parentBlock, ts.SymbolFlags.BlockScoped);
    for (const symbol of symbols) {
      unsafeRenameTargets.add(symbol.name);
    }
  }
  return unsafeRenameTargets;  
}

const symbolToRelatedTypes = (symbol: ts.Symbol, checker: ts.TypeChecker) => {
  const types: ts.Type[] = [];
  if (symbol.declarations) {
    for (const decl of symbol.declarations) {
      const declaredType = checker.getTypeAtLocation(decl);
      if (declaredType == null) continue;
      types.push(declaredType);
    }
  }
  if (symbol.valueDeclaration) {
    const type = checker.getTypeOfSymbolAtLocation(symbol, symbol.valueDeclaration);
    types.push(type);
  }
  return types;
}

export function createCollector(checker: ts.TypeChecker, debug = false) {
  const log = createLogger("[collector]", debug);
  const visitedSymbol = new Set<ts.Symbol>();
  const visitedType = new Set<ts.Type>();
  const visitedNode = new Set<ts.Node>();

  return {
    isRelated,
    getRelatedTypes: () => visitedType,
    isRelatedNode,
    isRelatedSymbol,
    visitNode,
    visitType,
    visitSymbol,
  }

  function isRelatedNode(node: ts.Node) {
    // console.log("isRelatedNode", ts.SyntaxKind[node.kind], node.getText().slice(0, 10));
    if (ts.isPropertySignature(node.parent) && node.parent.type) {
      return isRelated(node.parent.type);
    }
    if (ts.isMethodSignature(node.parent) && node.parent.type) {
      return isRelated(node.parent.type);
    }

    const symbol = checker.getSymbolAtLocation(node);
    const type = checker.getTypeAtLocation(node);
    if (symbol) {
      return isRelated(symbol, type, node);
    } else {
      return isRelated(type, node);
    }
  }

  function isRelatedSymbol(symbol: ts.Symbol) {
    const type = checker.getDeclaredTypeOfSymbol(symbol);
    const node = symbol.valueDeclaration;

    return isRelated(symbol, type, ...[
      ...node ? [node] : [],
      ...symbol.declarations ? symbol.declarations : [],
    ]);
  }


  function isRelated(...symbols: Array<ts.Symbol | ts.Type | ts.Node>) {
    return symbols.some(symbol => visitedSymbol.has(symbol as ts.Symbol) || visitedType.has(symbol as ts.Type) || visitedNode.has(symbol as ts.Node));
  }

  function visitNode(node: ts.Node, depth = 0) {
    if (visitedNode.has(node)) return;
    visitedNode.add(node);
    log("  ".repeat(depth),"[node]", ts.SyntaxKind[node.kind], node.getText().slice(0, 10));
    const symbol = checker.getSymbolAtLocation(node);
    symbol && visitSymbol(symbol, depth + 1);
    const type = checker.getTypeAtLocation(node);
    visitType(type, depth + 1);
    // ts.forEachChild (node, (node => visitNode(node, depth + 1)));
  }
  function visitType(node: ts.Type, depth = 0) {
    if (visitedType.has(node)) return;
    visitedType.add(node);
    log("  ".repeat(depth), "[type]", checker.typeToString(node));

    const type = node;
    if (node.symbol) {
      visitSymbol(node.symbol, depth + 1);
    }

    if (type.aliasSymbol) {
      visitSymbol(type.aliasSymbol, depth + 1);
      const aliasType = checker.getDeclaredTypeOfSymbol(type.aliasSymbol);
      visitType(aliasType, depth + 1);
    }
    if (type.aliasTypeArguments) {
      for (const typeArg of type.aliasTypeArguments) {
        visitType(typeArg);
      }
    }
    if (type.isUnion()) {
      for (const t of type.types) {
        visitType(t, depth + 1);
      }
    }
    if (type.isIntersection()) {
      for (const t of type.types) {
        // debugLog("  ".repeat(depth + 1), "[Intersection]");
        visitType(t, depth + 1);
      }
    }

    for (const property of type.getProperties()) {
      if (property.valueDeclaration) {
        visitNode(property.valueDeclaration, depth + 1);
      }
      visitSymbol(property, depth + 1);
    };

    // // TODO: Handle pattern?
    // // if (type.pattern) {
    // // }

    for (const signature of checker.getSignaturesOfType(type, ts.SignatureKind.Call)) {
      // debugLog("  ".repeat(depth), "[CallSignature]");
      // const nextDebug = debug;
      for (const param of signature.parameters) {
        visitSymbol(param, depth + 1);
      }
      if (signature.typeParameters) {
        for (const typeParam of signature.typeParameters) {
          visitType(typeParam, depth + 2);
        }
      }
      const returnType = checker.getReturnTypeOfSignature(signature);
      visitType(returnType, depth + 1);
      // debugLog("  ".repeat(depth + 1), "[ReturnType]", checker.typeToString(returnType));
      // traverse(returnType, depth + 2, nextDebug);
    }

  }
  function visitSymbol(symbol: ts.Symbol, depth = 0) {
    if (visitedSymbol.has(symbol)) return;
    visitedSymbol.add(symbol);

    log("  ".repeat(depth), "[symbol]", symbol.name);
    if (symbol.valueDeclaration) {
      visitNode(symbol.valueDeclaration, depth + 1);
    }
    if (symbol.declarations) {
      for (const decl of symbol.declarations) {
        visitNode(decl, depth + 1);
      }
    }
  }
}