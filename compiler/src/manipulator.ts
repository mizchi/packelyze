/**
 * Top Level API for manipulating TypeScript source code.
 */
// import { LanguageService, Program, SourceFile, SymbolFlags } from "typescript";
import ts from "typescript";
import { collectUnsafeRenameTargets, collectScopedSymbols } from "./analyzer";
import { RenameItem, findRenameDetails, getRenameAppliedState } from "./renamer";
import { createSymbolBuilder } from "./symbolBuilder";

export function writeRenamedFileState(
  service: ts.LanguageService,
  source: ts.SourceFile,
  normalizePath: (path: string) => string,
  writeFile: (fname: string, content: string) => void
) {
  const program = service.getProgram()!;
  const scopedSymbols = collectScopedSymbols(program, source);
  const renames: RenameItem[] = [];
  const symbolBuilder = createSymbolBuilder();

  // to inhibit rename of global names or other scope
  const unsafeRenameTargets = collectUnsafeRenameTargets(program, source, scopedSymbols);
  for (const blockedSymbol of scopedSymbols) {
    if (blockedSymbol.isExportRelated) continue;
    const declaration = blockedSymbol.symbol.valueDeclaration;
    if (declaration) {
      const locs = findRenameDetails(service, declaration.getSourceFile(), declaration.getStart());
      if (locs) {
        const newName = symbolBuilder.create((newName) => !unsafeRenameTargets.has(newName));

        renames.push(
          ...locs.map((loc) => ({
            ...loc,
            original: blockedSymbol.symbol.getName(),
            to: newName,
          }))
        );  
      }
    }
  }

  const state = getRenameAppliedState(renames, (fname) => {
    const source = program.getSourceFile(fname);
    return source && source.text;
  }, normalizePath);
  
  for (const [fname, content] of state) {
    const [changed, changedStart, changedEnd] = content;
    writeFile(fname, changed);
  }
}

