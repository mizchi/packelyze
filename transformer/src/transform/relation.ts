import ts from "typescript";
import type { BindingNode, ProjectExported } from "./transformTypes";
import { SymbolWalker, SymbolWalkerResult } from "../ts/types";
import { composeWalkers, formatCode, isNamedDeclaration, toReadableNode } from "../ts/tsUtils";
import {
  getEffectDetectorWalker as getEffectDetector,
  getExternalDetectorWalker as getExternalDetector,
} from "./detector";
import { createGetSymbolWalker } from "../ts/symbolWalker";
import { getAnnotationAtNode } from "../ts/comment";

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

export function createIsBindingExported(checker: ts.TypeChecker, projectExported: ProjectExported) {
  return (binding: BindingNode) => {
    // special case for property assignment
    if (ts.isPropertyAssignment(binding.parent) && binding.parent.name === binding) {
      const type = checker.getTypeAtLocation(binding.parent);
      if (projectExported.types.includes(type)) {
        return true;
      }
      if (type.symbol && projectExported.symbols.includes(type.symbol)) {
        return true;
      }
      // inferred object type member will skip mangle: ex. const x = {vvv: 1};
      const objectType = checker.getTypeAtLocation(binding.parent.parent);
      if (objectType.symbol?.name === "__object") {
        return true;
      }
    }
    {
      const parent = binding.parent as ts.NamedDeclaration;
      const symbol = checker.getSymbolAtLocation(binding);
      const type = checker.getTypeAtLocation(binding);
      if (projectExported.nodes.includes(parent)) {
        return true;
      }
      if (symbol && projectExported.symbols.includes(symbol)) {
        return true;
      }
      if (type.symbol && projectExported.symbols.includes(type.symbol)) {
        return true;
      }
    }
    return false;
  };
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

  function walkExportedSymbol(symbol: ts.Symbol) {
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
  function walkRootFile(root: ts.SourceFile) {
    const fileSymbol = checker.getSymbolAtLocation(root);
    if (!fileSymbol) return;
    const exportedSymbols = checker.getExportsOfModule(fileSymbol);

    for (const symbol of exportedSymbols) {
      walkExportedSymbol(symbol);
    }
  }

  function walkTargetFile(file: ts.SourceFile) {
    const effectNodes: Set<ts.Node> = new Set();
    const walk = composeWalkers(
      // collect effect nodes
      getEffectDetector(checker, (node) => {
        effectNodes.add(node);
      }),
      getExternalDetector((node) => {
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
