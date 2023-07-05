/**
 * Top Level API for manipulating TypeScript source code.
 */
// import { LanguageService, Program, SourceFile, SymbolFlags } from "typescript";
import ts from "typescript";
import { collectUnsafeRenameTargets, collectScopedSymbols } from "./transformer/analyzer";
import { RenameItem, RenameSourceKind, collectRenameItems, getRenameAppliedState } from "./transformer/renamer";
import { createSymbolBuilder } from "./symbolBuilder";

export function writeRenamedFileState(
  service: ts.LanguageService,
  source: ts.SourceFile,
  normalizePath: (path: string) => string,
  writeFile: (fname: string, content: string) => void,
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
      const newName = symbolBuilder.create((newName) => !unsafeRenameTargets.has(newName));
      const locs = collectRenameItems(
        service,
        declaration.getSourceFile(),
        declaration.getStart(),
        RenameSourceKind.ScopedIdentifier,
        blockedSymbol.symbol.getName(),
        newName,
      );
      locs && renames.push(...locs);
    }
  }

  const state = getRenameAppliedState(
    renames,
    (fname) => {
      const source = program.getSourceFile(fname);
      return source && source.text;
    },
    normalizePath,
  );

  for (const [fname, content] of state) {
    const [changed, changedStart, changedEnd] = content;
    writeFile(fname, changed);
  }
}
