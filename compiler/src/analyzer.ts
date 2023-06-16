// import { Program, Node, SourceFile, FunctionDeclaration, FunctionExpression, isFunctionDeclaration } from "typescript";
import { Block, ClassDeclaration, FunctionDeclaration, Node, Program, Signature, SourceFile, Symbol, SymbolFlags, Type, isExpression, isFunctionDeclaration, isVariableStatement } from "typescript";
import { createTypeVisitor, visitLocalBlockScopeSymbols } from "./nodeUtils";
// import { findGlobalTypes, findGlobalVariables, visitLocalBlockScopeSymbols } from "./finder";

export type ScopedSymbol = {
  symbol: Symbol;
  parentBlock: Block | ClassDeclaration | FunctionDeclaration;
  paths: (Block | ClassDeclaration | FunctionDeclaration)[];
  isExportRelated?: boolean;
}

export function findScopedSymbols(program: Program, file: SourceFile, debug = false): ScopedSymbol[] {
  // const debugLog = debug ? console.log : () => {};
  const checker = program.getTypeChecker();
  const collector = createRelatedTypesCollector(program, debug);

  const exportSymbols = findExportSymbols(program, file, debug);
  const globalVariables = findGlobalVariables(program, file);
  const globalTypes = findGlobalTypes(program, file);

  for (const symbol of exportSymbols) {
    collector.collectRelatedTypesFromSymbol(symbol);
    // console.log("exportSymbols", symbol.getName(), symbol.declarations?.map(x => x.getText()));
  }
  for (const symbol of globalVariables) {
    collector.collectRelatedTypesFromSymbol(symbol);
  }
  for (const symbol of globalTypes) {
    collector.collectRelatedTypesFromSymbol(symbol);
  }

  const result: ScopedSymbol[] = [];
  
  // console.log("---start---", file.fileName);
  visitLocalBlockScopeSymbols(program, file, (symbol, parentBlock, paths, depth) => {
    // console.log("symbol", symbol.getName(), symbol.declarations?.length);

    if (symbol.valueDeclaration == null) {
      const type = checker.getTypeOfSymbolAtLocation(symbol, symbol.valueDeclaration!);
      const isExportRelated = collector.isRelatedType(type);
      result.push({
        symbol,
        parentBlock,
        isExportRelated,
        paths,
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
            paths,
          });  
        }  
      }
    }
  }, 0, debug);
  // console.log("exportSymbols", exportSymbols.map(x => x.getName()));
  return result;
}

export function createRelatedTypesCollector(program: Program, debug = false) {
  const checker = program.getTypeChecker();
  // let symbols = new Map<string, Symbol>();
  let relatedTypes = new Set<Type>();

  const debugLog = debug ? console.log : () => {};

  const visitType = createTypeVisitor(checker, debug);

  return {
    getRelatedTypes: () => relatedTypes,
    isRelatedType: (type: Type) => relatedTypes.has(type),
    isRelatedTypeFromSymbol: (symbol: Symbol) => {
      const type = checker.getTypeOfSymbolAtLocation(symbol, symbol.valueDeclaration!);
      return relatedTypes.has(type);
    },

    collectRelatedTypesFromNode: (node: Node, depth = 0): Set<Type> => {
      collectRelatedTypesFromNode(node, depth);
      return relatedTypes;
    },
    collectRelatedTypesFromSymbol: (symbol: Symbol, depth = 0): Set<Type> => {
      // console.log("symbol!", symbol.getName(), symbol.declarations?.map(x => x.getText()));
      if (symbol.declarations) {
        for (const decl of symbol.declarations) {
          const declaredType = checker.getTypeAtLocation(decl);
          if (declaredType == null) continue;
          collectRelatedType(declaredType, depth);
        }
      }
      if (symbol.valueDeclaration == null) {
        return relatedTypes;
      }
      const type = checker.getTypeOfSymbolAtLocation(symbol, symbol.valueDeclaration);
      collectRelatedType(type, depth);
      return relatedTypes;
    },
  }

  function collectRelatedType(type: Type, depth = 0) {
    visitType(type, (type) => {
      if (relatedTypes.has(type)) {
        return true;
      }
      // if (primitives.includes(checker.typeToString(type))) {
      //   return true;
      // }
      relatedTypes.add(type);
    });
    return;
  }

  function collectRelatedTypesFromNode(node: Node, depth = 0) {
    if (isFunctionDeclaration(node)) {
      const signature = checker.getSignatureFromDeclaration(node);
      if (signature == null) {
        return;
      }
      debugLog("  ".repeat(depth), "[FunctionType:Signature]", node.name?.getText());
      return collectRelatedTypesFromSignature(signature, depth + 1);
    }

    if (isVariableStatement(node)) {
      if (node.declarationList.declarations == null) return;
      for (const decl of node.declarationList.declarations) {
        const type = checker.getTypeAtLocation(decl);
        debugLog("  ".repeat(depth), "[VariableType]", decl.name.getText());
        collectRelatedType(type, depth + 1);
      }
    }

    if (isExpression(node)) {
      const exprType = checker.getTypeAtLocation(node);
      debugLog("  ".repeat(depth), "[ExpressionType]", node.getFullText().slice(0, 10));
      return collectRelatedType(exprType, depth + 1);
    }
  }

  function collectRelatedTypesFromSignature(signature: Signature, depth = 0) {
    const returnType = signature.getReturnType();
    const params = signature.getParameters();
    const typeParams = signature.getTypeParameters();

    debugLog("  ".repeat(depth), "[Paramters]");
    for (const param of params) {
      const paramType = checker.getTypeOfSymbolAtLocation(param, param.valueDeclaration!);
      debugLog("  ".repeat(depth + 1), "[P]", param.name);
      collectRelatedType(paramType, depth + 2);
    }
    // TODO: Traverse
    debugLog("  ".repeat(depth), "[TypeParamters]");
    if (typeParams) {
      for (const typeParam of typeParams) {
        debugLog("  ".repeat(depth + 1), "[TP]", checker.typeToString(typeParam));
        collectRelatedType(typeParam, depth + 2);
      }  
    }

    debugLog("  ".repeat(depth), "[ReturnType]", checker.typeToString(returnType));
    collectRelatedType(returnType, depth + 1);
  }
}

export function findExportSymbols(program: Program, source: SourceFile, debug = false): Symbol[] {
  const checker = program.getTypeChecker();
  const symbol = checker.getSymbolAtLocation(source);
  const exportSymbols = checker.getExportsOfModule(symbol!);
  return exportSymbols;
}

export function getImportableModules(program: Program, file: SourceFile) {
  const checker = program.getTypeChecker();
  const values = checker.getSymbolsInScope(file, SymbolFlags.ValueModule);
  return values;  
}

export function findGlobalVariables(program: Program, file: SourceFile) {
  const checker = program.getTypeChecker();
  const scopedSymbols =  new Set(checker.getSymbolsInScope(file, SymbolFlags.BlockScoped));

  const variables = checker.getSymbolsInScope(file, SymbolFlags.Variable).filter((s) => {
    return !scopedSymbols.has(s);
  });
  return variables;
}

export function findGlobalTypes(program: Program, file: SourceFile) {
  const checker = program.getTypeChecker();
  const types = checker.getSymbolsInScope(file, SymbolFlags.Type).filter((s) => {
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
export function collectUnsafeRenameTargets(program: Program, source: SourceFile, scopedSymbols: ScopedSymbol[]) {
  const checker = program.getTypeChecker();
  const unsafeRenameTargets = new Set<string>();
  // register global names to unsafe
  for (const gvar of findGlobalVariables(program, source)) {
    unsafeRenameTargets.add(gvar.name);
  }
  // register existed local names to unsafe
  for (const blockSymbol of scopedSymbols) {
    const symbols = checker.getSymbolsInScope(blockSymbol.parentBlock, SymbolFlags.BlockScoped);
    for (const symbol of symbols) {
      unsafeRenameTargets.add(symbol.name);
    }
  }
  return unsafeRenameTargets;  
}

