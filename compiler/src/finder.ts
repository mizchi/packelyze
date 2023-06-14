import {
  forEachChild,
  isExportSpecifier,
  isExpression,
  isIdentifier,
  isSourceFile,
  Node,
  NodeFlags,
  Program,
  SourceFile,
  SymbolFlags,
  SyntaxKind,
} from "typescript";

export function findRenameSymbols(program: Program, source: SourceFile) {
  const checker = program.getTypeChecker();
  const symbols = new Map<string, string[]>();
  // checker.getExportSpecifierLocalTargetSymbol.po
  // const x = checker.getExportSpecifierLocalTargetSymbol()
  // const syms = checker.getSymbolsInScope(
  //   source,
  //   SymbolFlags.ExportValue,
  //   //  | SymbolFlags.ModuleExports,
  // );
  // for (const sym of syms) {
  //   console.log("export sym", sym.getName());
  //   // const decls = sym.getDeclarations();

  //   // const decls = sym.getDeclarations();
  //   // if (decls != null) {
  //   //   const fname = decls[0].getSourceFile().fileName;
  //   //   if (symbols.has(fname)) {
  //   //     symbols.get(fname)!.push(sym.getName());
  //   //   } else {
  //   //     symbols.set(fname, [sym.getName()]);
  //   //   }
  //   // }
  // }
  // console.log("syms", syms.length);
  // const exportSymbols = checker.getExportsOfModule(source.symbol);

  const visit = (node: Node, depth: number = 0) => {
    const head = node.getFullText().slice(0, 10).replace(/\n/g, "");
    const symbol = checker.getSymbolAtLocation(node);
    console.log(
      "  ".repeat(depth),
      `[${SyntaxKind[node.kind]}]`,
      head + (head.length > 10 ? "..." : ""),
      /// Get Contextual Type
      // isExpression(node) ? checker.getContextualType(node) ?? "" : "",
      /// Get Type At Location
      // symbol &&
      //   checker.getTypeOfSymbolAtLocation(symbol, node),
    );
    // if (isIdentifier(node)) {
    //   const nodeSymbol = checker.getSymbolAtLocation(node);
    //   const exportedSymbol = nodeSymbol &&
    //     checker.getExportSymbolOfSymbol(nodeSymbol);
    //   console.log(
    //     "  ".repeat(depth),
    //     "[exported?]",
    //     nodeSymbol?.name,
    //     nodeSymbol === exportedSymbol,
    //     // nodeSymbol &&
    //     //   checker.getExportSymbolOfSymbol(nodeSymbol)?.valueDeclaration
    //     //     ?.getSourceFile().fileName.replace(process.cwd(), ""),
    //     // exportedNode?.name,
    //     // node === exportedNode,
    //   );
    // }

    // if (isExportSpecifier(node) || isIdentifier(node)) {
    //   // const
    //   // const exportedNode = checker.getExportSpecifierLocalTargetSymbol(node);
    //   const nodeSymbol = checker.getSymbolAtLocation(node);
    //   // const exportedNode = checker.getExportSymbolOfSymbol(nodeSymbol!);

    //   // if (exportedNode !== node) {
    //   // }
    //   console.log(
    //     "  ".repeat(depth),
    //     "[exported?]",
    //     checker.getExportSymbolOfSymbol(nodeSymbol!)?.name,
    //     // exportedNode?.name,
    //     // node === exportedNode,
    //   );
    // }
    // if (isSourceFile(node)) {

    // }
    forEachChild(node, (child) => visit(child, depth + 1));
  };
  source.forEachChild(visit);
  // source.forEachChild((node) => {
  //   if (node.name != null) {
  //     const name = node.name.getText(source);
  //     if (name != null) {
  //       const symbol = node.symbol;
  //       if (symbol != null) {
  //         const declarations = symbol.getDeclarations();
  //         if (declarations != null) {
  //           const fname = declarations[0].getSourceFile().fileName;
  //           if (symbols.has(fname)) {
  //             symbols.get(fname)!.push(name);
  //           } else {
  //             symbols.set(fname, [name]);
  //           }
  //         }
  //       }
  //     }
  //   }
  // });
  return symbols;
}
