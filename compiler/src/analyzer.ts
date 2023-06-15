// import { Program, Node, SourceFile, FunctionDeclaration, FunctionExpression, isFunctionDeclaration } from "typescript";
import { FunctionDeclaration, Type, Node, Symbol, isFunctionDeclaration, TypeChecker, FunctionExpression, Program, Signature, isExpression, isVariableStatement, VariableStatement, isTypeAliasDeclaration, TypeAliasDeclaration, SourceFile, TypeFlags } from "typescript";
import { createTypeVisitor } from "./utils";

export function analyzeTopLevelExports(program: Program, entryFileName: string) {
  // TODO
  return [];
}

export function getFunctionSignature(program: Program, file: SourceFile, func: FunctionDeclaration | FunctionExpression) {
  return "";
}

const primitives = [
  "string",
  "number",
  "boolean",
  "void",
  "any",
  "unknown",
  "never",
  "undefined",
  "null",
  "symbol",
  "object",
  "bigint",
];

export function createRelatedTypesCollector(program: Program, debug = false) {
  const checker = program.getTypeChecker();
  // let symbols = new Map<string, Symbol>();
  let relatedTypes = new Set<Type>();

  const debugLog = debug ? console.log : () => {};

  const visitType = createTypeVisitor(checker, debug);

  return {
    collectRelatedTypes: (node: Node, depth = 0): Set<Type> => {
      collectRelatedTypesFromNode(node, depth);
      return relatedTypes;
    },
  }

  function collectRelatedType(type: Type, depth = 0) {
    visitType(type, (type) => {
      if (relatedTypes.has(type)) {
        return true;
      }
      if (primitives.includes(checker.typeToString(type))) {
        return true;
      }
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
