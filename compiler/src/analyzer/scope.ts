import ts from "typescript";

export type AnalyzedScope = {
  block: ts.Block | ts.SourceFile,
  locals: Set<ts.Symbol>;
  children: AnalyzedScope[];
}

/** get all scoped locals */
export function analyzeScope(checker: ts.TypeChecker, file: ts.SourceFile): AnalyzedScope {
  const globals = getGlobalsFromFile(checker, file);
  return analyzeBlock(file);

  function analyzeBlock(block: ts.Block | ts.SourceFile) {
    const locals = getLocalsInScope(checker, globals, block);
    const children = new Set<AnalyzedScope>();
    for (const child of getDirectChildren(block)) {
      const analyzed = analyzeBlock(child);
      children.add(analyzed);
    }
    return {
      block,
      locals,
      children: [...children]
    };
  }
  function getDirectChildren(node: ts.Block | ts.SourceFile): Set<ts.Block> {
    const children: Set<ts.Block> = new Set();
    const visit = (node: ts.Node) => {
      if (ts.isBlock(node)) {
        children.add(node);
        return;
      } else {
        ts.forEachChild(node, visit);
      }
    };
    ts.forEachChild(node, visit);
    return children;
  }
}

export function getGlobalsFromFile(checker: ts.TypeChecker, file: ts.SourceFile): Set<ts.Symbol> {
  const globals = new Set<ts.Symbol>();
  for (const value of checker.getSymbolsInScope(file, ts.SymbolFlags.Value)) {
    // special reserved words
    if (value.name === "globalThis" || value.name === "undefined") {
      globals.add(value);
    }
    else if (value.declarations?.some(d => d.getSourceFile() !== file)) {
      globals.add(value);
    }
  }
  return globals;
}

export function getLocals(checker: ts.TypeChecker, node: ts.Node): Set<ts.Symbol> {
  if (ts.isSourceFile(node)) {
    const locals: Set<ts.Symbol> = new Set();
    for (const symbol of checker.getSymbolsInScope(node, ts.SymbolFlags.BlockScopedVariableExcludes)) {
      if (symbol.declarations?.some(d => d.getSourceFile() === node)) {
        locals.add(symbol);
      }
    }
    return locals;
  }
  if (ts.isFunctionDeclaration(node)) {
    return new Set(checker.getSymbolsInScope(node, ts.SymbolFlags.FunctionScopedVariableExcludes));
  }
  if (ts.isBlock(node)) {
    return new Set(checker.getSymbolsInScope(node, ts.SymbolFlags.BlockScopedVariableExcludes));
  }
  if (ts.isModuleDeclaration(node)) {
    return new Set(checker.getSymbolsInScope(node, ts.SymbolFlags.BlockScopedVariableExcludes));
  }
  throw new Error(`not implemented ${ts.SyntaxKind[node.kind]}`);
}

export function getClosestBlock(node: ts.Node): ts.Node {
  if (ts.isSourceFile(node)) return node;

  let parent = node.parent;
  while (parent) {
    if (ts.isSourceFile(parent)) return parent;
    if (ts.isBlock(parent)) return parent;
    // if (ts.isStatement(parent)) return node.parent;
    parent = parent.parent!;
  }
  throw new Error("unreachable");
}

export function getLocalsInScope(checker: ts.TypeChecker, globals: Set<ts.Symbol>,  node: ts.Node): Set<ts.Symbol> {
  if (ts.isSourceFile(node)) {
    // const globals = getGlobalsFromFile(checker, node);
    const locals: Set<ts.Symbol> = new Set();
    for (const value of checker.getSymbolsInScope(node, ts.SymbolFlags.BlockScopedVariableExcludes)) {
      if (value.declarations?.some(d => d.getSourceFile() === node)) {
        locals.add(value);
      }
    }
    return locals;
  }

  if (ts.isFunctionDeclaration(node)) {
    // ininitalize locals
    const locals = new Set(checker.getSymbolsInScope(node, ts.SymbolFlags.FunctionScopedVariableExcludes));

    // delete from globals
    for (const global of globals) {
      locals.delete(global);
    }

    const parent = getClosestBlock(node);
    const parentLocals = getLocals(checker, parent);
    // delete from parent
    for (const parentLocal of parentLocals) {
      const isRegistered = parentLocal.name === "arguments" || parentLocal.name === "this" || parentLocal.name === "super" || parentLocal.name === "globalThis";
      if (isRegistered) continue;
      locals.delete(parentLocal);
    }
    return locals;
  }
  if (ts.isBlock(node)) {
    const parent = getClosestBlock(node);
    const parentLocals = getLocals(checker, parent);
    const locals = new Set(checker.getSymbolsInScope(node, ts.SymbolFlags.BlockScopedVariableExcludes));

    // delete from globals
    for (const global of globals) {
      locals.delete(global);
    }

    for (const parentLocal of parentLocals) {
      locals.delete(parentLocal);
    }
    return locals;
  }

  if (ts.isModuleDeclaration(node)) {
    const locals = new Set(checker.getSymbolsInScope(node, ts.SymbolFlags.BlockScopedVariableExcludes));
    return locals;
  }
  throw new Error(`not implemented ${ts.SyntaxKind[node.kind]}`);
}

// get local rename candidates
export function getLocalBindings(node: ts.Node) {
  const decls: ts.Declaration[] = [];
  const typeDecls: ts.Declaration[] = [];
  const idents: ts.Identifier[] = [];

  ts.forEachChild(node, visit);
  return idents;

  function visit(node: ts.Node) {
    if (ts.isVariableDeclaration(node)) {
      decls.push(node);
      visitBinding(node.name);
    }
    if (ts.isTypeAliasDeclaration(node)) {
      typeDecls.push(node);
      visitBinding(node.name);
    }
    if (ts.isInterfaceDeclaration(node)) {
      typeDecls.push(node);
      visitBinding(node.name);
    }
    if (ts.isClassDeclaration(node)) {
      decls.push(node);
      if (node.name) {
        visitBinding(node.name);
      }
    }

    if (ts.isPropertyDeclaration(node)) {
      decls.push(node);
      visitBinding(node.name);
    }
    if (ts.isMethodDeclaration(node)) {
      decls.push(node);
      visitBinding(node.name);
    }

    if (ts.isPropertySignature(node)) {
      typeDecls.push(node);
      visitBinding(node.name);
    }
    if (ts.isMethodSignature(node)) {
      typeDecls.push(node);
      visitBinding(node.name);
    }
    if (ts.isGetAccessorDeclaration(node)) {
      decls.push(node);
      visitBinding(node.name);
    }
    if (ts.isSetAccessorDeclaration(node)) {
      decls.push(node);
      visitBinding(node.name);
    }

    if (ts.isFunctionDeclaration(node)) {
      decls.push(node);
      if (node.name) {
        visitBinding(node.name);
      }
    }
    if (ts.isFunctionExpression(node)) {
      if (node.name) {
        visitBinding(node.name);
      }
    }

    if (ts.isEnumDeclaration(node)) {
      decls.push(node);
      if (node.name) {
        visitBinding(node.name);
      }
    }
    if (ts.isModuleDeclaration(node)) {
      decls.push(node);
      if (node.name) {
        visitBinding(node.name);
      }
    }
    ts.forEachChild(node, visit);
  }
  function visitBinding(node: ts.BindingPattern | ts.BindingElement | ts.Identifier | ts.ArrayBindingElement | ts.ObjectBindingPattern |ts.PropertyName) {
    if (ts.isIdentifier(node)) {
      idents.push(node);
    }
    // TODO: consider computed property
    if (ts.isComputedPropertyName(node)) {
      // visitBinding(node.expression);
    }
    if (ts.isBindingElement(node)) {
      visitBinding(node.name);
      if (node.propertyName) {
        visitBinding(node.propertyName);
      }
    }
    if (ts.isObjectBindingPattern(node)) {
      for (const element of node.elements) {
        visitBinding(element);
      }
    }
    if (ts.isArrayBindingPattern(node)) {
      for (const element of node.elements) {
        visitBinding(element);
      }
    }
  }
}

export function findAcendantLocals(checker: ts.TypeChecker, block: ts.Block) {
  const blocks = new Set<ts.Block>();
  const visit = (node: ts.Node) => {
    if (ts.isBlock(node)) {
      blocks.add(node);
      return;
    }
    ts.forEachChild(node, visit);
  }
  ts.forEachChild(block, visit);

  const currentLocals = getLocals(checker, block);

  const ascendantLocals: Set<ts.Symbol> = new Set();
  for (const block of blocks) {
    for (const blockLocal of getLocals(checker, block)) {
      if (!currentLocals.has(blockLocal)) {
        ascendantLocals.add(blockLocal);
      }
    }
    // recursive
    for (const ascendantLocal of findAcendantLocals(checker, block) ) {
      if (!currentLocals.has(ascendantLocal)) {
        ascendantLocals.add(ascendantLocal);
      }
    }
  }
  return ascendantLocals;
}
