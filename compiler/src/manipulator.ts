import { LanguageService, SourceFile, SymbolFlags } from "typescript";
import { ScopedSymbol, findGlobalVariables, findScopedSymbols } from "./analyzer";
import { RenameInfo, findRenameLocations, getRenameAppliedState } from "./rename";
import { createSymbolBuilder } from "./symbolBuilder";

export function getRenamedFileState(service: LanguageService, source: SourceFile, normalizePath: (path: string) => string) {
  const program = service.getProgram()!;
  const scopedSymbols = findScopedSymbols(program, source);
  const renames: RenameInfo[] = [];
  const symbolBuilder = createSymbolBuilder();
  const checker = program.getTypeChecker();

  const unsafeRenameTargets = collectUnsafeRenameTargets(scopedSymbols);
  for (const blockedSymbol of scopedSymbols) {
    const declaration = blockedSymbol.symbol.valueDeclaration;
    if (declaration) {
      const locs = findRenameLocations(service, declaration.getSourceFile(), declaration.getStart());
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

  // console.log("unsafeRenameTargets", unsafeRenameTargets,
  //   "renames", renames.map(r => ({ original: r.original, to: r.to }))
  // );

  const state = getRenameAppliedState(renames, (fname) => {
    const source = program.getSourceFile(fname);
    return source && source.text;
  }, normalizePath);

  return state;

  // collect unsafe rename targets
  function collectUnsafeRenameTargets(scopedSymbols: ScopedSymbol[]) {
    const unsafeRenameTargets = new Set<string>();
    // register global names to unsafe
    for (const gvar of findGlobalVariables(program, source)) {
      unsafeRenameTargets.add(gvar.name);
    }
    // register existed local names to unsafe
    for (const blockSymbol of scopedSymbols) {
      const symbols = checker.getSymbolsInScope(blockSymbol.parentBlock, SymbolFlags.BlockScoped);
      for (const symbol of symbols) {
        unsafeRenameTargets.add(symbol.name);
      }
    }
    return unsafeRenameTargets;  
  }
}

