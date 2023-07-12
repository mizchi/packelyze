// import { SymbolWalker, createGetSymbolWalker } from './../analyzer/symbolWalker';
import ts from "typescript";
import { type SymbolWalkerVisited, createGetSymbolWalker } from "../typescript/symbolWalker";
import { SymbolBuilder, createSymbolBuilder } from "./symbolBuilder";
import { findBatchRenameLocations } from "../typescript/renamer";
import { getEffectDetectorEnter } from "./effects";
import { composeVisitors, toReadableNode, toReadableSymbol } from "../typescript/utils";
import { FindRenameLocations } from "../typescript/types";
import { type MangleAction, MangleTargetNode } from "./types";
import { type BatchRenameLocation } from "../typescript/types";

export function walkProjectForMangle(
  checker: ts.TypeChecker,
  root: ts.SourceFile,
  files: ts.SourceFile[],
): SymbolWalkerVisited {
  const symbolWalker = createGetSymbolWalker(checker)();
  walkExportedRelatedNodesFromRoot(root);
  for (const file of files) {
    walkFile(file);
  }
  return symbolWalker.getVisited();

  function walkExportedRelatedNodesFromRoot(root: ts.SourceFile) {
    const exportedSymbols = checker.getExportsOfModule(checker.getSymbolAtLocation(root)!);
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

export function getMangleActionsForFile(
  checker: ts.TypeChecker,
  visited: SymbolWalkerVisited,
  file: ts.SourceFile,
): MangleAction[] {
  const symbolBuilder = createSymbolBuilder();
  const exportedNodes = findDeclarationsFromSymbolWalkerVisited(visited);

  const mangleNodes = getMangleNodesForFile(file);

  return mangleNodes.flatMap((node) => {
    const action = getMangleActionForNode(symbolBuilder, node);
    return action ?? [];
  });

  function getMangleNodesForFile(file: ts.SourceFile): ts.Node[] {
    const bindings = getBindingsForFile(file);
    // console.log(
    //   "[findMangleNodesForFile]",
    //   file.fileName,
    //   [...bindings].map((s) => toReadableNode(s)),
    // );

    const manglables = new Set<ts.Node>();
    // need this?
    const exportSymbols = checker.getExportsOfModule(checker.getSymbolAtLocation(file)!);

    // console.log(
    //   "[findMangleNodesForFile]",
    //   [...exportSymbols].map((s) => toReadableSymbol(s)),
    // );
    for (const identifier of bindings) {
      // skip: type <Foo> = { ... }
      if (ts.isTypeAliasDeclaration(identifier.parent) && identifier.parent.name === identifier) {
        continue;
      }
      // skip: interface <Foo>{ ... }
      if (ts.isInterfaceDeclaration(identifier.parent) && identifier.parent.name === identifier) {
        continue;
      }

      // node is related to export
      if (exportedNodes.has(identifier.parent)) {
        // console.log("skip: exported", identifier.text);
        continue;
      }

      // node is exported
      const symbol = checker.getSymbolAtLocation(identifier);
      if (symbol && exportSymbols.includes(symbol)) {
        continue;
      }

      // const type = checker.getTypeAtLocation(identifier);
      // if (visited.visitedTypes.includes(type)) {
      //   continue;
      // }

      // console.log("[mangler:add]", identifier.text, "in", ts.SyntaxKind[identifier.parent.kind]);

      manglables.add(identifier);
    }
    return [...manglables];
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
    // declarable nodes
    // stop if declared

    const isParentClass = !!(node.parent && (ts.isClassDeclaration(node.parent) || ts.isClassExpression(node.parent)));

    if (ts.isVariableStatement(node)) {
      // stop if declare cont v: ...;
      if (hasDeclareOrAbstract(node)) return;
    }

    // only for classes
    // ObjectLiteral's methodDeclaration will be broken
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
    if (ts.isVariableDeclaration(node)) {
      visitNamedBinding(node.name);
    }
    if (ts.isTypeAliasDeclaration(node)) {
      visitNamedBinding(node.name);
    }
    if (ts.isInterfaceDeclaration(node)) {
      visitNamedBinding(node.name);
    }
    if (ts.isPropertySignature(node)) {
      visitNamedBinding(node.name);
    }
    if (ts.isGetAccessorDeclaration(node)) {
      visitNamedBinding(node.name);
    }
    if (ts.isSetAccessorDeclaration(node)) {
      visitNamedBinding(node.name);
    }

    // has named node
    if (ts.isFunctionExpression(node)) {
      if (node.name) {
        visitNamedBinding(node.name);
      }
    }
    if (ts.isClassExpression(node)) {
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

export function findDeclarationsFromSymbolWalkerVisited(visited: SymbolWalkerVisited, debug: boolean = false) {
  const log = debug ? console.log : () => {};
  const visitedNodes = new Set<ts.Node>();
  for (const symbol of visited.visitedSymbols) {
    for (const declaration of symbol.getDeclarations() ?? []) {
      visitNode(declaration, 0);
    }
  }

  for (const type of visited.visitedTypes) {
    if (type.symbol) {
      for (const declaration of type.symbol.getDeclarations() ?? []) {
        visitNode(declaration, 0);
      }
    }
    // if (type.aliasSymbol) {
    //   for (const declaration of type.aliasSymbol.getDeclarations() ?? []) {
    //     visitNode(declaration, 0);
    //   }
    //   for (const declaration of (type.aliasTypeArguments ?? []).flatMap((x) => x.symbol?.getDeclarations() ?? [])) {
    //     visitNode(declaration, 0);
    //   }
    // }
    // for (const declaration of symbol.getDeclarations() ?? []) {
    //   visitNode(declaration, 0);
    // }
  }

  return visitedNodes;

  function isMangleTargetNode(node: ts.Node): node is MangleTargetNode {
    return (
      ts.isTypeNode(node) ||
      ts.isTypeAliasDeclaration(node) ||
      ts.isInterfaceDeclaration(node) ||
      ts.isTypeLiteralNode(node) ||
      ts.isClassDeclaration(node) ||
      ts.isPropertySignature(node) ||
      ts.isMethodSignature(node) ||
      ts.isMethodDeclaration(node) ||
      // ts.isFunctionDeclaration(node) ||
      ts.isPropertyDeclaration(node) ||
      ts.isParameter(node) ||
      ts.isGetAccessor(node) ||
      ts.isSetAccessor(node)
    );
  }
  function visitNode(node: ts.Node, depth: number) {
    log("  ".repeat(depth) + "[Node:" + ts.SyntaxKind[node.kind] + "]", node.getText().slice(0, 10) + "...");

    if (!isMangleTargetNode(node)) return;
    if (visitedNodes.has(node)) return;
    visitedNodes.add(node);

    // now only for classes
    const isClassParent = !!(node.parent && (ts.isClassDeclaration(node.parent) || ts.isClassExpression(node.parent)));

    if (ts.isTypeAliasDeclaration(node)) {
      for (const typeParam of node.typeParameters ?? []) {
        visitNode(typeParam, depth + 1);
      }
      if (node.type) {
        visitNode(node.type, depth + 1);
      }
    }
    if (ts.isInterfaceDeclaration(node)) {
      // TODO
      // for (const heritageClause of node.heritageClauses ?? []) {
      //   for (const type of heritageClause.types) {
      //     visitNode(type.expression, depth + 1);
      //   }
      // }
      for (const typeParam of node.typeParameters ?? []) {
        visitNode(typeParam, depth + 1);
      }
      for (const member of node.members) {
        visitNode(member, depth + 1);
      }
    }

    if (ts.isClassDeclaration(node)) {
      for (const typeParam of node.typeParameters ?? []) {
        visitNode(typeParam, depth + 1);
      }
      // for (const member of node.members) {
      //   visitNode(member, depth + 1);
      // }
      for (const heritageClause of node.heritageClauses ?? []) {
        for (const type of heritageClause.types) {
          visitNode(type.expression, depth + 1);
        }
      }
    }

    if (ts.isTypeLiteralNode(node)) {
      for (const member of node.members) {
        visitNode(member, depth + 1);
      }
    }
    if (ts.isParameter(node)) {
      if (node.type) {
        visitNode(node.type, depth + 1);
      }
    }

    if (ts.isPropertySignature(node)) {
      if (node.type) {
        visitNode(node.type, depth + 1);
      }
    }
    if (ts.isMethodSignature(node)) {
      for (const param of node.parameters) {
        visitNode(param, depth + 1);
      }
    }

    if (ts.isPropertyDeclaration(node) && isClassParent) {
      if (node.type) {
        visitNode(node.type, depth + 1);
      }
    }
    // now only for classes
    if (ts.isMethodDeclaration(node) && isClassParent) {
      for (const param of node.parameters) {
        visitNode(param, depth + 1);
      }
    }

    if (ts.isGetAccessor(node)) {
      for (const param of node.parameters) {
        visitNode(param, depth + 1);
      }
    }
    if (ts.isSetAccessor(node)) {
      for (const param of node.parameters) {
        visitNode(param, depth + 1);
      }
    }
    if (ts.isObjectLiteralExpression(node)) {
      for (const prop of node.properties) {
        visitNode(prop, depth + 1);
      }
    }
    if (ts.isPropertyAssignment(node)) {
      visitNode(node.name, depth + 1);
    }
  }
}
