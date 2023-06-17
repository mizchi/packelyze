// import { LanguageService, Program, SourceFile, SymbolFlags } from "typescript";
import ts from "typescript";
import { ScopedSymbol, collectUnsafeRenameTargets, findGlobalVariables, findScopedSymbols } from "./analyzer";
import { BatchRenameItem, findRenameDetails, getRenameAppliedState } from "./rename";
import { createSymbolBuilder } from "./symbolBuilder";

export function writeRenamedFileState(
  service: ts.LanguageService,
  source: ts.SourceFile,
  normalizePath: (path: string) => string,
  writeFile: (fname: string, content: string) => void
) {
  const program = service.getProgram()!;
  const scopedSymbols = findScopedSymbols(program, source);
  const renames: BatchRenameItem[] = [];
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
        renames.push({
          original: blockedSymbol.symbol.getName(),
          to: newName,
          locations: locs!,
        });  
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

