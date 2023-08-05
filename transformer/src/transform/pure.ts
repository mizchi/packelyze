import ts from "typescript";
import { getAnnotationAtCallable, getAnnotationAtNode, getLeadingComments } from "../ts/comment";
import { formatCode, toReadableSymbol } from "../ts/tsUtils";

// for composeVisitors
export function getEffectDetectorWalker(
  checker: ts.TypeChecker,
  file: ts.SourceFile,
  onEnter: (node: ts.Node) => void = () => {},
) {
  const pureFuncs = getBuiltinPureFuncs(checker, file);
  return (node: ts.Node) => {
    if (ts.isBinaryExpression(node)) {
      // TODO: other modifing opertors
      const modifying = node.operatorToken.kind === ts.SyntaxKind.EqualsToken;
      if (modifying) {
        // TODO: right node
        const leftType = checker.getTypeAtLocation(node.left);
        if (leftType.symbol?.declarations?.every((x) => x.getSourceFile().isDeclarationFile)) {
          onEnter(node.right);
        }
      }
    }
    // call external calling is not safe for mangle
    if (ts.isCallExpression(node)) {
      // TODO: use __PURE__ annotation
      const type = checker.getTypeAtLocation(node.expression);
      const isAmbient = type.symbol?.declarations?.every((x) => x.getSourceFile().isDeclarationFile);
      if (!pureFuncs.includes(type.symbol) && !isPureAnnotated(type.symbol) && isAmbient) {
        for (const typeArg of node.typeArguments ?? []) {
          onEnter(typeArg);
        }
        for (const arg of node.arguments) {
          onEnter(arg);
        }
      }
    }

    // FIXME object spread is unsafe for typescript renamer: like {...obj}
    if (ts.isSpreadAssignment(node) && ts.isObjectLiteralExpression(node.parent)) {
      onEnter(node.expression);
    }
  };
}

// for composeVisitors
export function getExternalDetectorWalker(onEnter: (node: ts.Node) => void = () => {}) {
  return (node: ts.Node) => {
    if (ts.isIdentifier(node) || ts.isPrivateIdentifier(node)) {
      const ann = getAnnotationAtNode(node);
      if (ann?.external) {
        onEnter(node);
      }
    }
  };
}

const BuiltinPureMembers = {
  Array: [
    "length",
    "concat",
    "every",
    "filter",
    "find",
    "findIndex",
    "forEach",
    "includes",
    "indexOf",
    "join",
    "lastIndexOf",
    "map",
    // "pop",
    // "push",
    "reduce",
    "reduceRight",
    // "reverse",
    // "shift",
    "slice",
    "some",
    // "sort",
    // "splice",
    "toLocaleString",
    "toString",
    // "unshift",
  ],
  String: [
    "length",
    "charAt",
    "charCodeAt",
    "codePointAt",
    "concat",
    "endsWith",
    "includes",
    "indexOf",
    "lastIndexOf",
    "localeCompare",
    "match",
    "matchAll",
    "normalize",
    "padEnd",
    "padStart",
    "repeat",
    "replace",
    "search",
    "slice",
    "split",
    "startsWith",
    "substring",
    "toLocaleLowerCase",
    "toLocaleUpperCase",
    "toLowerCase",
    "toString",
    "toUpperCase",
    "trim",
    "trimEnd",
    "trimStart",
    "valueOf",
  ],
  Number: ["toExponential", "toFixed", "toLocaleString", "toPrecision", "toString", "valueOf"],
  Boolean: ["toString", "valueOf"],
  Date: [
    "getDate",
    "getDay",
    "getFullYear",
    "getHours",
    "getMilliseconds",
    "getMinutes",
    "getMonth",
    "getSeconds",
    "getTime",
    "getTimezoneOffset",
    "getUTCDate",
    "getUTCDay",
    "getUTCFullYear",
    "getUTCHours",
    "getUTCMilliseconds",
    "getUTCMinutes",
    "getUTCMonth",
    "getUTCSeconds",
    "getYear",
    // "setDate",
    // "setFullYear",
    // "setHours",
    // "setMilliseconds",
    // "setMinutes",
    // "setMonth",
    // "setSeconds",
    // "setTime",
    // "setUTCDate",
    // "setUTCFullYear",
    // "setUTCHours",
    // "setUTCMilliseconds",
    // "setUTCMinutes",
    // "setUTCMonth",
    // "setUTCSeconds",
    // "setYear",
    "toDateString",
    "toISOString",
    "toJSON",
    "toLocaleDateString",
    "toLocaleString",
    "toLocaleTimeString",
    "toString",
    "toTimeString",
    "toUTCString",
    "valueOf",
  ],
  RegExp: ["compile", "exec", "test", "toString"],
  Map: [
    // "clear",
    // "delete",
    "forEach",
    "get",
    "has",
    // "set",
    "size",
  ],
  Set: [
    // "add",
    // "clear",
    // "delete",
    "forEach",
    "has",
    "size",
  ],
  WeakMap: [
    // "clear",
    // "delete",
    "get",
    // "has",
    // "set",
  ],
  WeakSet: [
    // "add",
    // "clear",
    // "delete",
    // "has",
  ],
  ArrayBuffer: ["byteLength", "slice", "isView"],
  PromiseConstructor: ["race", "reject", "resolve", "all", "allSettled", "any"],
};

function getBuiltinPureFuncs(checker: ts.TypeChecker, root: ts.SourceFile) {
  const pureSymbols: Set<ts.Symbol> = new Set();
  const pureTypes: Set<ts.Type> = new Set();
  const types = checker.getSymbolsInScope(root, ts.SymbolFlags.Type);
  const PromiseCstr = types.find((x) => x.name === "PromiseConstructor");
  const PromiseCstrType = checker.getDeclaredTypeOfSymbol(PromiseCstr!);
  PromiseCstrType.symbol?.members?.forEach((member) => {
    pureSymbols.add(member);
    for (const memberDecl of member.declarations ?? []) {
      const memberType = checker.getTypeOfSymbolAtLocation(member, memberDecl);
      if (memberType.symbol) {
        pureSymbols.add(memberType.symbol);
      }
      pureTypes.add(memberType);
      for (const sig of checker.getSignaturesOfType(memberType, ts.SignatureKind.Call)) {
        for (const param of sig.getParameters()) {
          pureSymbols.add(param);
          const paramType = checker.getTypeOfSymbolAtLocation(param, memberDecl);
          pureTypes.add(paramType);
        }
      }
    }
  });
  return [...pureSymbols];
}

const PURE_PROMISE_RESOLVERS = ["resolve", "reject"];
function isPureAnnotated(symbol: ts.Symbol) {
  return symbol?.declarations?.some((callerDecl) => {
    if (ts.isFunctionTypeNode(callerDecl) && ts.isPropertySignature(callerDecl.parent)) {
      const ann = getAnnotationAtCallable(callerDecl.parent);
      return ann.NO_SIDE_EFFECT;
    }
    if (
      ts.isFunctionDeclaration(callerDecl) ||
      ts.isMethodDeclaration(callerDecl) ||
      ts.isMethodSignature(callerDecl)
    ) {
      const ann = getAnnotationAtCallable(callerDecl);
      return ann.NO_SIDE_EFFECT;
    }
    return false;
  });
}
