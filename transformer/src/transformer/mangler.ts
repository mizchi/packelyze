// import { SymbolWalker, createGetSymbolWalker } from './../analyzer/symbolWalker';
import ts from "typescript";
import { createGetSymbolWalker } from "../typescript/symbolWalker";
import { createSymbolBuilder } from "./symbolBuilder";
import { findBatchRenameLocations } from "../typescript/renamer";
import { getEffectDetectorEnter } from "./effects";
import { composeVisitors, toReadableNode, toReadableSymbol } from "../typescript/utils";
import { FindRenameLocations, SymbolWalkerResult } from "../typescript/types";
import { type MangleAction, MangleTargetNode, SymbolBuilder } from "./types";
import { type BatchRenameLocation } from "../typescript/types";

export function isMangleIdentifier(
  checker: ts.TypeChecker,
  identifier: ts.Identifier | ts.PrivateIdentifier,
  exportedNodes: ts.Node[],
  exportedSymbols: ts.Symbol[],
) {
  // skip: type <Foo> = { ... }
  if (ts.isTypeAliasDeclaration(identifier.parent) && identifier.parent.name === identifier) {
    return false;
  }
  // skip: interface <Foo>{ ... }
  if (ts.isInterfaceDeclaration(identifier.parent) && identifier.parent.name === identifier) {
    return false;
  }

  // node is related to export
  if (exportedNodes.includes(identifier.parent)) {
    // console.log("skip: exported", identifier.text);
    return false;
  }

  // FIXME
  // node is exported
  const symbol = checker.getSymbolAtLocation(identifier);
  if (symbol && exportedSymbols.includes(symbol)) {
    return false;
  }
  return true;
}

export function isWalkableRelatedNode(node: ts.Node): node is MangleTargetNode {
  return (
    ts.isTypeNode(node) ||
    ts.isTypeAliasDeclaration(node) ||
    ts.isInterfaceDeclaration(node) ||
    ts.isTypeLiteralNode(node) ||
    ts.isClassDeclaration(node) ||
    ts.isPropertySignature(node) ||
    ts.isMethodSignature(node) ||
    ts.isMethodDeclaration(node) ||
    ts.isPropertyDeclaration(node) ||
    ts.isParameter(node) ||
    ts.isGetAccessor(node) ||
    ts.isSetAccessor(node) ||
    ts.isIntersectionTypeNode(node) ||
    ts.isUnionTypeNode(node)
  );
}

export function walkProjectForMangle(
  checker: ts.TypeChecker,
  rootFiles: ts.SourceFile[],
  files: ts.SourceFile[],
): SymbolWalkerResult {
  const symbolWalker = createGetSymbolWalker(checker)();
  for (const root of rootFiles) {
    walkExportedRelatedNodesFromRoot(root);
  }
  for (const file of files) {
    walkFile(file);
  }
  return symbolWalker.getVisited();

  function walkExportedRelatedNodesFromRoot(root: ts.SourceFile) {
    const fileSymbol = checker.getSymbolAtLocation(root);
    if (!fileSymbol) return;
    const exportedSymbols = checker.getExportsOfModule(fileSymbol);
    for (const exported of exportedSymbols) {
      symbolWalker.walkSymbol(exported);
      const type = checker.getTypeOfSymbol(exported);
      symbolWalker.walkType(type);
    }
  }

  function walkFile(file: ts.SourceFile) {
    const effectNodes: Set<ts.Node> = new Set();
    const composed = composeVisitors(
      // collect effect nodes
      getEffectDetectorEnter(checker, (node) => {
        effectNodes.add(node);
      }),
    );
    composed(file);

    for (const node of effectNodes) {
      const symbol = checker.getSymbolAtLocation(node);
      if (symbol) symbolWalker.walkSymbol(symbol);
      const type = checker.getTypeAtLocation(node);
      symbolWalker.walkType(type);
    }
  }
}

export function getMangleActionsForFile(
  checker: ts.TypeChecker,
  visited: SymbolWalkerResult,
  file: ts.SourceFile,
): MangleAction[] {
  const symbolBuilder = createSymbolBuilder();

  const relatedNodes = findRelatedNodes(visited);

  const mangleNodes = getMangleNodesForFile(file);

  return mangleNodes.flatMap((node) => {
    const action = getMangleActionForNode(symbolBuilder, node);
    return action ?? [];
  });

  function getMangleNodesForFile(file: ts.SourceFile): ts.Node[] {
    const bindings = getBindingsForFile(file);
    const fileSymbol = checker.getSymbolAtLocation(file);
    const exportSymbols = fileSymbol ? checker.getExportsOfModule(fileSymbol) : [];
    return bindings.filter((identifier) => {
      return isMangleIdentifier(checker, identifier, relatedNodes, exportSymbols);
    });
  }

  function getMangleActionForNode(symbolBuilder: SymbolBuilder, node: ts.Node): MangleAction | undefined {
    const validate = createNameValidator(checker, node);
    if (!(ts.isIdentifier(node) || ts.isPrivateIdentifier(node))) {
      throw new Error("unexpected node type " + node.kind);
    }
    const originalName = node.text;

    // maybe react component name
    // TODO: const Foo = ...;
    const maybeFunctionComponentNode =
      (ts.isFunctionDeclaration(node.parent) || ts.isFunctionExpression(node.parent)) &&
      isComponentFunctionName(originalName);
    if (maybeFunctionComponentNode) {
      // console.log("[mangle] maybe react component", originalName);
      return;
    }
    // create new symbol builder?

    // FIXME: should consume converted name for usedNames check
    const newName = (originalName.startsWith("#") ? "#" : "") + symbolBuilder.create(validate);
    const isPropertyAssignment = ts.isPropertyAssignment(node.parent);
    return {
      fileName: node.getSourceFile().fileName,
      original: originalName,
      to: newName,
      start: node.getStart(),
      isAssignment: isPropertyAssignment,
    };
    function isComponentFunctionName(name: string) {
      return !/[a-z]/.test(name[0]);
    }
    function createNameValidator(checker: ts.TypeChecker, node: ts.Node) {
      // TODO: check is valid query
      const locals = checker.getSymbolsInScope(node, ts.SymbolFlags.BlockScopedVariable);
      const localNames = new Set(locals.map((x) => x.name));
      const usedNames = new Set<string>();
      return (newName: string) => {
        const conflicted = localNames.has(newName);
        const used = usedNames.has(newName);
        if (!conflicted && !used) {
          usedNames.add(newName);
          return true;
        }
        return false;
      };
    }
  }
}

// get local rename candidates
type BindingIdentifier = ts.Identifier | ts.PrivateIdentifier;
export function getBindingsForFile(file: ts.SourceFile): BindingIdentifier[] {
  const identifiers: (ts.Identifier | ts.PrivateIdentifier)[] = [];
  ts.forEachChild(file, visit);
  return identifiers;
  function visit(node: ts.Node) {
    // console.log("[bindings]", ts.SyntaxKind[node.kind], "\n" + node.getText());
    if (ts.isVariableStatement(node) && hasDeclareOrAbstract(node)) {
      // stop if declare const ...
      return;
    }
    // only for classes
    // ObjectLiteral's methodDeclaration will be broken
    const isParentClass = !!(node.parent && (ts.isClassDeclaration(node.parent) || ts.isClassExpression(node.parent)));
    if (isParentClass && (ts.isMethodDeclaration(node) || ts.isPropertyDeclaration(node))) {
      if (hasDeclareOrAbstract(node)) return;
      visitNamedBinding(node.name);
    }
    if (
      ts.isFunctionDeclaration(node) ||
      ts.isClassDeclaration(node) ||
      ts.isEnumDeclaration(node) ||
      ts.isModuleDeclaration(node)
    ) {
      if (hasDeclareOrAbstract(node)) return;
      if (node.name) {
        visitNamedBinding(node.name);
      }
    }

    // named binding
    if (
      ts.isVariableDeclaration(node) ||
      ts.isTypeAliasDeclaration(node) ||
      ts.isInterfaceDeclaration(node) ||
      ts.isPropertySignature(node) ||
      ts.isGetAccessorDeclaration(node) ||
      ts.isSetAccessorDeclaration(node)
    ) {
      visitNamedBinding(node.name);
    }
    // nameable node
    if (ts.isFunctionExpression(node) || ts.isClassExpression(node)) {
      if (node.name) {
        visitNamedBinding(node.name);
      }
    }
    // TODO: activate for infered nodes
    // if (ts.isPropertyAssignment(node)) {
    //   visitBinding(node.name);
    // }
    ts.forEachChild(node, visit);
  }
  function visitNamedBinding(
    node:
      | ts.BindingPattern
      | ts.BindingElement
      | ts.Identifier
      | ts.PrivateIdentifier
      | ts.ArrayBindingElement
      | ts.ObjectBindingPattern
      | ts.PropertyName,
  ) {
    if (ts.isIdentifier(node) || ts.isPrivateIdentifier(node)) {
      identifiers.push(node);
    }
    // TODO: consider computed property
    if (ts.isComputedPropertyName(node)) {
      // visitBinding(node.expression);
    }
    if (ts.isBindingElement(node)) {
      visitNamedBinding(node.name);
      if (node.propertyName) {
        visitNamedBinding(node.propertyName);
      }
    }
    if (ts.isObjectBindingPattern(node)) {
      for (const element of node.elements) {
        visitNamedBinding(element);
      }
    }
    if (ts.isArrayBindingPattern(node)) {
      for (const element of node.elements) {
        visitNamedBinding(element);
      }
    }
  }
  function hasDeclareOrAbstract(
    node:
      | ts.VariableStatement
      | ts.FunctionDeclaration
      | ts.ClassDeclaration
      | ts.ModuleDeclaration
      | ts.EnumDeclaration
      | ts.MethodDeclaration
      | ts.PropertyDeclaration,
  ): boolean {
    return (
      node.modifiers?.some(
        (m) => m.kind === ts.SyntaxKind.DeclareKeyword || m.kind === ts.SyntaxKind.AbstractKeyword,
      ) ?? false
    );
  }
}

export function findRelatedNodes(visited: SymbolWalkerResult, debug: boolean = false): ts.Node[] {
  const log = debug ? console.log : () => {};
  const relatedNodes = new Set<ts.Node>();
  for (const symbol of visited.symbols) {
    for (const declaration of symbol.getDeclarations() ?? []) {
      visitRelatedNode(declaration, 0);
    }
  }

  for (const type of visited.types) {
    if (type.symbol) {
      for (const declaration of type.symbol.getDeclarations() ?? []) {
        visitRelatedNode(declaration, 0);
      }
    }
  }

  return [...relatedNodes];

  function visitRelatedNode(node: ts.Node, depth: number) {
    log("  ".repeat(depth) + "[Node:" + ts.SyntaxKind[node.kind] + "]", node.getText().slice(0, 10) + "...");

    if (!isWalkableRelatedNode(node)) return;
    if (relatedNodes.has(node)) return;
    relatedNodes.add(node);

    // now only for classes
    const isClassParent = !!(node.parent && (ts.isClassDeclaration(node.parent) || ts.isClassExpression(node.parent)));

    if (ts.isTypeAliasDeclaration(node)) {
      for (const typeParam of node.typeParameters ?? []) {
        visitRelatedNode(typeParam, depth + 1);
      }
      if (node.type) {
        visitRelatedNode(node.type, depth + 1);
      }
    }
    if (ts.isInterfaceDeclaration(node)) {
      // TODO
      for (const heritageClause of node.heritageClauses ?? []) {
        for (const type of heritageClause.types) {
          visitRelatedNode(type.expression, depth + 1);
        }
      }
      for (const typeParam of node.typeParameters ?? []) {
        visitRelatedNode(typeParam, depth + 1);
      }
      for (const member of node.members) {
        visitRelatedNode(member, depth + 1);
      }
    }

    if (ts.isClassDeclaration(node)) {
      for (const typeParam of node.typeParameters ?? []) {
        visitRelatedNode(typeParam, depth + 1);
      }
      // for (const member of node.members) {
      //   visitNode(member, depth + 1);
      // }
      for (const heritageClause of node.heritageClauses ?? []) {
        for (const type of heritageClause.types) {
          visitRelatedNode(type.expression, depth + 1);
        }
      }
    }
    if (ts.isTypeLiteralNode(node)) {
      for (const member of node.members) {
        visitRelatedNode(member, depth + 1);
      }
    }
    if (ts.isParameter(node)) {
      if (node.type) {
        visitRelatedNode(node.type, depth + 1);
      }
    }
    if (ts.isPropertySignature(node)) {
      if (node.type) {
        visitRelatedNode(node.type, depth + 1);
      }
    }
    if (ts.isMethodSignature(node)) {
      for (const param of node.parameters) {
        visitRelatedNode(param, depth + 1);
      }
    }
    if (ts.isPropertyDeclaration(node) && isClassParent) {
      if (node.type) {
        visitRelatedNode(node.type, depth + 1);
      }
    }
    // now only for classes
    if (ts.isMethodDeclaration(node) && isClassParent) {
      for (const param of node.parameters) {
        visitRelatedNode(param, depth + 1);
      }
    }
    if (ts.isGetAccessor(node)) {
      for (const param of node.parameters) {
        visitRelatedNode(param, depth + 1);
      }
    }
    if (ts.isSetAccessor(node)) {
      for (const param of node.parameters) {
        visitRelatedNode(param, depth + 1);
      }
    }
    if (ts.isObjectLiteralExpression(node)) {
      for (const prop of node.properties) {
        visitRelatedNode(prop, depth + 1);
      }
    }
    if (ts.isPropertyAssignment(node)) {
      visitRelatedNode(node.name, depth + 1);
    }

    // walk types
    if (ts.isUnionTypeNode(node) || ts.isIntersectionTypeNode(node)) {
      for (const type of node.types) {
        visitRelatedNode(type, depth + 1);
      }
    }
  }
}

// exclude duplicated rename locations
export function expandToSafeBatchRenameLocations(findRenameLocations: FindRenameLocations, actions: MangleAction[]) {
  // propertyAssingment causes duplicated rename with propertySignature
  const preActions = actions.filter((x) => !x.isAssignment);
  const postActions = actions.filter((x) => x.isAssignment);
  // stop rename for same position
  const touchingLocations = new Set<string>();

  return [...preActions.flatMap(actionToRenamesIfSafe), ...postActions.flatMap(actionToRenamesIfSafe)];

  function actionToRenamesIfSafe(action: MangleAction) {
    const touchKey = actionToKey(action);
    if (touchingLocations.has(touchKey)) return [];
    const renames = findBatchRenameLocations(
      findRenameLocations,
      action.fileName,
      action.start,
      action.original,
      action.to,
    );
    if (!renames) return [];

    // stop by conflict
    const renameKeys = renames.map(renameLocationToKey);
    if (renameKeys.some((key) => touchingLocations.has(key))) {
      return [];
    }
    for (const renameKey of renameKeys) {
      touchingLocations.add(renameKey);
    }
    return renames;
  }

  function actionToKey(action: MangleAction) {
    return `${action.fileName}:${action.start}`;
  }
  function renameLocationToKey(rename: BatchRenameLocation) {
    return `${rename.fileName}:${rename.textSpan.start}`;
  }
}
