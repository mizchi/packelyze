import ts from "typescript";
import { getAnnotationAtNode } from "../ts/comment";
import { findBatchRenameLocations } from "../ts/renamer";
import { createGetSymbolWalker } from "../ts/symbolWalker";
import { composeWalkers, isNamedDeclaration } from "../ts/tsUtils";
import type { BatchRenameLocation, FindRenameLocations } from "../ts/types";
import { sortBy } from "../utils";
import { MangleValidator, WarningCode, type OnWarning } from "./../types";
import { getEffectDetectorWalker, getExternalDetectorWalker } from "./detector";
import { createSymbolBuilder } from "./symbolBuilder";
import { BatchRenameLocationWithSource, BindingNode, ProjectExported, type CodeAction } from "./transformTypes";

const enum NodePriority {
  VeryHigh = 0,
  High = 1,
  Normal = 5,
  Low = 10,
  VeryLow = 20,
}

export function getExportedInProject(
  checker: ts.TypeChecker,
  exportedFiles: ts.SourceFile[],
  localFiles: ts.SourceFile[],
): ProjectExported {
  const internalNodes: BindingNode[] = [];
  const externalNodes: BindingNode[] = [];

  const accept = (symbol: ts.Symbol) => {
    const decl = symbol.valueDeclaration;
    if (decl && isNamedDeclaration(decl) && decl.name && ts.isIdentifier(decl.name)) {
      const annotation = getAnnotationAtNode(decl.name);
      if (annotation?.internal === true) {
        console.log("[walker:accept] force internal", decl.name.getText(), annotation);
        internalNodes.push(decl.name);
        return false;
      }
    }
    return true;
  };

  const symbolWalker = createGetSymbolWalker(checker)(accept);
  for (const root of exportedFiles) {
    walkRootFile(root);
  }
  for (const file of localFiles) {
    walkTargetFile(file);
  }
  const visited = symbolWalker.getVisited();
  return {
    symbols: visited.symbols,
    types: visited.types,
    nodes: visited.nodes as ts.NamedDeclaration[],
    internal: internalNodes,
    external: externalNodes,
  } satisfies ProjectExported;

  function walkRootFile(root: ts.SourceFile) {
    const fileSymbol = checker.getSymbolAtLocation(root);
    if (!fileSymbol) return;
    const exportedSymbols = checker.getExportsOfModule(fileSymbol);

    for (const symbol of exportedSymbols) {
      if (symbol.valueDeclaration && ts.isImportSpecifier(symbol.valueDeclaration)) {
        const importedType = checker.getTypeAtLocation(symbol.valueDeclaration);
        symbolWalker.walkType(importedType);
        symbolWalker.walkSymbol(importedType.symbol);
      }

      if (symbol.valueDeclaration && ts.isExportSpecifier(symbol.valueDeclaration)) {
        // check exported
        if (ts.isExportSpecifier(symbol.valueDeclaration)) {
          const originalSymbol = checker.getExportSpecifierLocalTargetSymbol(symbol.valueDeclaration);
          if (originalSymbol) {
            for (const decl of originalSymbol?.declarations ?? []) {
              const symbol = checker.getSymbolAtLocation(decl);
              if (symbol) symbolWalker.walkSymbol(symbol);
            }
          } else {
            const specifierType = checker.getTypeAtLocation(symbol.valueDeclaration);
            symbolWalker.walkType(specifierType);
            specifierType.symbol && symbolWalker.walkSymbol(specifierType.symbol);
          }
        }
      } else {
        const type = checker.getTypeOfSymbol(symbol);
        symbolWalker.walkSymbol(symbol);
        symbolWalker.walkType(type);
        if (type.symbol) {
          symbolWalker.walkSymbol(type.symbol);
        }
      }
    }
  }

  function walkTargetFile(file: ts.SourceFile) {
    const effectNodes: Set<ts.Node> = new Set();
    const walk = composeWalkers(
      // collect effect nodes
      getEffectDetectorWalker(checker, (node) => {
        effectNodes.add(node);
      }),
      getExternalDetectorWalker((node) => {
        effectNodes.add(node);
        if (ts.isIdentifier(node) || ts.isPrivateIdentifier(node)) {
          externalNodes.push(node);
        }
      }),
    );
    ts.forEachChild(file, walk);
    // walk(file);

    for (const node of effectNodes) {
      const symbol = checker.getSymbolAtLocation(node);
      // if (symbol) walkSymbol(symbol);
      if (symbol) symbolWalker.walkSymbol(symbol);
      const type = checker.getTypeAtLocation(node);
      symbolWalker.walkType(type);
    }
  }
}

export function isExportedCreator(
  checker: ts.TypeChecker,
  projectExported: ProjectExported,
  validator: MangleValidator,
) {
  return (node: BindingNode) => {
    const validatorRejected = validator?.(node) === false;
    // TODO: why first hidden is skipped by case24-annotations
    if (validatorRejected) {
      return false;
    }
    if (isTypeDecralation(node)) {
      return false;
    }
    if (projectExported.internal.includes(node)) {
      return true;
    }

    // special case for property assignment
    if (ts.isPropertyAssignment(node.parent) && node.parent.name === node) {
      const type = checker.getTypeAtLocation(node.parent);
      if (projectExported.types.includes(type)) {
        return false;
      }
      if (type.symbol && projectExported.symbols.includes(type.symbol)) {
        return false;
      }
      // inferred object type member will skip mangle: ex. const x = {vvv: 1};
      const objectType = checker.getTypeAtLocation(node.parent.parent);
      if (objectType.symbol?.name === "__object") {
        return false;
      }
    }
    const parent = node.parent as ts.NamedDeclaration;
    const symbol = checker.getSymbolAtLocation(node);
    const type = checker.getTypeAtLocation(node);
    if (projectExported.nodes.includes(parent)) {
      return false;
    }
    if (symbol && projectExported.symbols.includes(symbol)) {
      return false;
    }
    if (type.symbol && projectExported.symbols.includes(type.symbol)) {
      return false;
    }
    return true;
  };
  function isTypeDecralation(binding: BindingNode) {
    return (
      (ts.isTypeAliasDeclaration(binding.parent) || ts.isInterfaceDeclaration(binding.parent)) &&
      binding.parent.name === binding
    );
  }
}

export function getLocalNodesInFile(
  // checker: ts.TypeChecker,
  // projectExported: ProjectExported,
  file: ts.SourceFile,
  isExported: (node: BindingNode) => boolean,
  // validator?: MangleValidator,
): BindingNode[] {
  const bindings = getLocalsInFile(file);
  return bindings.filter(isExported);
  //   const validatorRejected = validator?.(binding) === false;
  //   // TODO: why first hidden is skipped by case24-annotations
  //   if (validatorRejected) {
  //     return false;
  //   }
  //   if (isTypeDecralation(binding)) {
  //     return false;
  //   }
  //   if (projectExported.internal.includes(binding)) {
  //     return true;
  //   }
  //   const exported = isExported(binding);
  //   if (exported) {
  //     return false;
  //   }
  //   return true;
  // });
}

export function getCodeActionsFromBindings(
  checker: ts.TypeChecker,
  bindings: BindingNode[],
  withOriginalComment: boolean = false,
): CodeAction[] {
  const symbolBuilder = createSymbolBuilder();
  return bindings.flatMap((node) => {
    return getCodeActionForBinding(node) ?? [];
  });

  function getCodeActionForBinding(node: BindingNode): CodeAction | undefined {
    const validate = createNameValidator(checker, node);
    const originalName = node.text;

    // maybe react component name
    // TODO: const Foo = ...;
    const maybeFunctionComponentNode =
      (ts.isFunctionDeclaration(node.parent) || ts.isFunctionExpression(node.parent)) &&
      isComponentFunctionName(originalName);
    if (maybeFunctionComponentNode) {
      return;
    }

    // TODO: renamer by ast kind
    const newName = (originalName.startsWith("#") ? "#" : "") + symbolBuilder.create(validate);
    const to = withOriginalComment ? `/*${originalName}*/${newName}` : newName;
    const annotation = getAnnotationAtNode(node);

    if (annotation?.external) {
      // stop by external
      return;
    }
    const action: CodeAction = {
      parentKind: node.parent.kind,
      actionType: "replace",
      fileName: node.getSourceFile().fileName,
      original: originalName,
      to,
      annotation: annotation,
      start: node.getStart(),
      node,
    };
    return action;
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

export function getLocalsInFile(file: ts.Node): BindingNode[] {
  const identifiers: (ts.Identifier | ts.PrivateIdentifier)[] = [];
  ts.forEachChild(file, visit);
  return identifiers;
  function visit(node: ts.Node) {
    if (isDeclareOrAbstractModified(node)) return;
    if (isNamedDeclaration(node) && isSupportedNode(node) && node.name) {
      const names = getDeclarationNames(node.name);
      identifiers.push(...names);
    }
    ts.forEachChild(node, visit);
  }
  function isSupportedNode(node: ts.Node): node is ts.NamedDeclaration {
    const isClassMember = !!(node.parent && (ts.isClassDeclaration(node.parent) || ts.isClassExpression(node.parent)));
    if (isClassMember && (ts.isMethodDeclaration(node) || ts.isPropertyDeclaration(node))) {
      return true;
    }
    if (
      ts.isFunctionDeclaration(node) ||
      ts.isClassDeclaration(node) ||
      ts.isEnumDeclaration(node) ||
      ts.isModuleDeclaration(node) ||
      ts.isVariableDeclaration(node) ||
      ts.isTypeAliasDeclaration(node) ||
      ts.isInterfaceDeclaration(node) ||
      ts.isPropertySignature(node) ||
      ts.isGetAccessorDeclaration(node) ||
      ts.isSetAccessorDeclaration(node) ||
      ts.isFunctionExpression(node) ||
      ts.isClassExpression(node) ||
      ts.isPropertyAssignment(node)
    ) {
      return true;
    }
    return false;
  }
  function getDeclarationNames(node: ts.DeclarationName | ts.BindingElement | ts.ArrayBindingElement) {
    const identifiers: (ts.Identifier | ts.PrivateIdentifier)[] = [];
    function walk(node: ts.DeclarationName | ts.BindingElement | ts.ArrayBindingElement) {
      if (ts.isIdentifier(node) || ts.isPrivateIdentifier(node)) {
        identifiers.push(node);
      }
      // TODO: consider computed property
      if (ts.isComputedPropertyName(node)) {
        // expect string or symbol literal
        // visitBinding(node.expression);
      }
      if (ts.isBindingElement(node)) {
        walk(node.name);
        if (node.propertyName) {
          walk(node.propertyName);
        }
      }
      if (ts.isObjectBindingPattern(node) || ts.isArrayBindingPattern(node)) {
        for (const element of node.elements) {
          walk(element);
        }
      }
    }
    walk(node);
    return identifiers;
  }

  function isDeclareOrAbstractModified(node: ts.Node): boolean {
    return (
      (
        node as ts.Node & {
          /**@external*/
          modifiers?: ts.NodeArray<ts.ModifierLike>;
        }
      ).modifiers?.some((m) => m.kind === ts.SyntaxKind.DeclareKeyword || m.kind === ts.SyntaxKind.AbstractKeyword) ??
      false
    );
  }
}

// exclude duplicated rename locations
export function expandToSafeRenameLocations(
  findRenameLocations: FindRenameLocations,
  actions: CodeAction[],
  onWarning?: OnWarning,
): BatchRenameLocationWithSource[] {
  const touchings = new Set<string>();
  return sortBy(actions, getActionPriority).flatMap(toSafeRenameLocations);

  function toSafeRenameLocations(action: CodeAction): BatchRenameLocationWithSource[] {
    const touchKey = actionToKey(action);
    if (touchings.has(touchKey)) return [];
    const locations = findBatchRenameLocations(
      findRenameLocations,
      action.fileName,
      action.start,
      action.original,
      action.to,
    );
    if (!locations) return [];

    // stop by conflict
    const tryingKeys = locations.map(renameToKey);
    if (tryingKeys.some((key) => touchings.has(key))) {
      const conflicts = tryingKeys.filter((key) => touchings.has(key));
      onWarning?.({
        code: WarningCode.MANGLE_STOP_BY_LOCATION_CONFLICT,
        message: conflicts.join("\n"),
      });
      return [];
    }
    for (const renameKey of tryingKeys) {
      touchings.add(renameKey);
    }
    return locations.map((rename) => ({ ...rename, action }) satisfies BatchRenameLocationWithSource);
  }

  function actionToKey(action: CodeAction): string {
    return `${action.fileName}-${action.start}`;
  }

  function renameToKey(rename: BatchRenameLocation): string {
    return `${rename.fileName}-${rename.textSpan.start}`;
  }
  function getActionPriority(action: CodeAction) {
    // prefer type signature
    if (ts.isTypeNode(action.node) || ts.isTypeNode(action.node.parent)) {
      return NodePriority.High;
    }

    if (action.node.parent.kind === ts.SyntaxKind.ObjectLiteralExpression) {
      return NodePriority.Low;
    }
    // Low priority for property assignment
    if (action.node.kind === ts.SyntaxKind.PropertyAssignment) {
      return NodePriority.VeryLow;
    }

    return NodePriority.Normal;
  }
}
