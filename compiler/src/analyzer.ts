// import { Program, Node, SourceFile, FunctionDeclaration, FunctionExpression, isFunctionDeclaration } from "typescript";
import { FunctionDeclaration, Type, Node, Symbol, isFunctionDeclaration, TypeChecker, FunctionExpression, Program, Signature, isExpression, isVariableStatement, VariableStatement, isTypeAliasDeclaration, TypeAliasDeclaration, SourceFile, TypeFlags, SyntaxKind, Block, SymbolFlags, forEachChild, isSourceFile, isBlock } from "typescript";
import { createTypeVisitor } from "./nodeUtils";
// import { findGlobalTypes, findGlobalVariables, visitLocalBlockScopeSymbols } from "./finder";

export type ScopedSymbol = {
  symbol: Symbol;
  parentBlock: Block;
  paths: Block[];
}

export function findScopedSymbols(program: Program, file: SourceFile, debug = false): ScopedSymbol[] {
  const debugLog = debug ? console.log : () => {};
  const checker = program.getTypeChecker();
  const collector = createRelatedTypesCollector(program, debug);

  const exportSymbols = findExportSymbols(program, file, debug);
  const globalVars = findGlobalVariables(program, file);
  const globalTypes = findGlobalTypes(program, file);

  for (const symbol of exportSymbols) {
    collector.collectRelatedTypesFromSymbol(symbol);
  }
  for (const symbol of globalVars) {
    collector.collectRelatedTypesFromSymbol(symbol);
  }
  for (const symbol of globalTypes) {
    collector.collectRelatedTypesFromSymbol(symbol);
  }

  const result: ScopedSymbol[] = [];
  visitLocalBlockScopeSymbols(program, file, (symbol, parentBlock, paths, depth) => {
    const type = checker.getTypeOfSymbolAtLocation(symbol, symbol.valueDeclaration!);
    const isExportRelated = collector.isRelatedType(type);

    // debugLog("  ".repeat(depth), "[Local]", symbol.name, checker.typeToString(type), isExportRelated);
    // console.log("  ".repeat(depth), "[Local]", symbol.name, checker.typeToString(type), isExportRelated);

    if (!isExportRelated) {
      result.push({
        symbol,
        parentBlock,
        paths,
      });
    }
    // collector.collectRelatedType(type);
  }, 0, debug);
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

export function findClosestBlock(node: Node) {
  while (node && !isSourceFile(node) && !isBlock(node)) {
    node = node.parent;
  }
  return node;
}

export function visitLocalBlockScope(file: SourceFile, visitor: (block: Block, paths: Block[], depth: number) => void, depth = 0, debug = false) {
  const debugLog = debug ? console.log : () => { };
  const visit = (node: Node, blockPaths: Block[], depth: number = 0) => {
    if (isSourceFile(node) || isBlock(node)) {
      const newPaths = [...blockPaths, node as Block];
      debugLog("  ".repeat(depth), `[block]`);
      visitor(node as Block, newPaths, depth);
      forEachChild(node, (node) => visit(node, newPaths, depth + 1));
    } else {
      forEachChild(node, (node) => visit(node, blockPaths, depth + 1));
    }
  };
  visit(file, [], depth);
}

export function visitLocalBlockScopeSymbols(program: Program, file: SourceFile, visitor: (symbol: Symbol, parentBlock: Block, paths: Block[], depth: number) => void, depth = 0, debug = false) {
  const debugLog = debug ? console.log : () => { };
  // console.log("debugLog", "---");
  const checker = program.getTypeChecker();
  const visit = (node: Node, blockPaths: Block[], depth: number = 0) => {
    if (isSourceFile(node) || isBlock(node)) {
      const newPaths = [...blockPaths, node as Block];
      const scopedSymbols = checker.getSymbolsInScope(node, SymbolFlags.BlockScoped);
      const scopedSymbolsInBlock = scopedSymbols.filter((sym) => {
        if (sym.valueDeclaration == null) return false;
        const closestBlock = findClosestBlock(sym.valueDeclaration);
        return node === closestBlock;
      });
      debugLog("  ".repeat(depth), `[block]`, scopedSymbolsInBlock.map((s) => s.name));
      for (const symbol of scopedSymbolsInBlock) {
        const decl = symbol.valueDeclaration;
        debugLog("  ".repeat(depth), `> [local]`, symbol.name, "-", decl && SyntaxKind[decl.kind]);
        visitor(symbol, node as Block, newPaths, depth);
      }
      forEachChild(node, (node) => visit(node, newPaths, depth + 1));
    } else {
      forEachChild(node, (node) => visit(node, blockPaths, depth + 1));
    }
  };
  visit(file, [], depth);
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
