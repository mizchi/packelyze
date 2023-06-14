import { expect, test } from "vitest";

import {
  createDocumentRegistry,
  createLanguageService,
  isFunctionDeclaration,
  isVariableStatement,
  Node,
  parseJsonConfigFileContent,
  readConfigFile,
  SourceFile,
  Symbol,
  SymbolFlags,
  sys,
  TypeChecker,
} from "typescript";
import path from "path";
import { createTestLanguageService } from "./testHarness";

const code = `
import { sub } from "./sub";

const internal = 1;
export const exported = 2;

function f1() {
  const value = 3;
  return { value };
}

// function f2() {
//   f1();
// }

export function g() {
  const g_internal = 4;
  console.log(g_internal);
  // document;
}

console.log(2);
`;

test.skip("finder: find all locals", () => {
  const { service, normalizePath, snapshotManager } =
    createTestLanguageService();
  snapshotManager.writeFileSnapshot(normalizePath("src/locals.ts"), code);

  const program = service.getProgram()!;
  const checker = program.getTypeChecker();

  const rootFile = program.getSourceFile(normalizePath("src/locals.ts"));
  const getSymbolNames = (flags: SymbolFlags) =>
    checker.getSymbolsInScope(
      rootFile!,
      flags,
    ).map((s) => s.name);
  const getSymbols = (flags: SymbolFlags) =>
    checker.getSymbolsInScope(
      rootFile!,
      flags,
    );

  expect(getSymbolNames(SymbolFlags.BlockScoped)).toEqual([
    "internal",
    "exported",
  ]);

  const keys = Object.keys(SymbolFlags);
  for (const flags of keys) {
    const flag = SymbolFlags[flags as keyof typeof SymbolFlags];
    if (typeof flag !== "number") {
      continue;
    }
    const symbolNames = getSymbolNames(flag);
    console.log(SymbolFlags[flag], symbolNames.length);
    // expect(getSymbols(flag))
    if (flag === SymbolFlags.FunctionExcludes) {
      console.log("--- FunctionExcludes ---", symbolNames);
      const symbols = getSymbols(flag);
      for (const symbol of symbols) {
        const decledSource = symbol.valueDeclaration?.getSourceFile();
        if (decledSource && decledSource.fileName.includes("/node_modules/")) {
          // console.log('')
        } else if (decledSource == null) {
          // console.log(
          //   "  --- decledSource ---",
          //   symbol.getName(),
          //   decledSource,
          // );
        } else {
          console.log(
            "  --- local ---",
            symbol.getName(),
            decledSource?.fileName.replace(process.cwd() + "/", ""),
          );
        }
        // console.log(
        //   "  --- decledSource ---",
        //   symbol.getName(),
        //   decledSource?.fileName,
        // );
      }
      break;
    }
    if (flag === SymbolFlags.Variable) {
      if (true as any) break;
      console.log("--- Variable ---", symbolNames);
      const symbols = getSymbols(flag);
      for (const symbol of symbols) {
        const decledSource = symbol.valueDeclaration?.getSourceFile();
        if (decledSource && decledSource.fileName.includes("/node_modules/")) {
          // console.log('')
        } else if (decledSource == null) {
          // console.log(
          //   "  --- decledSource ---",
          //   symbol.getName(),
          //   decledSource,
          // );
        } else {
          console.log(
            "  --- local ---",
            symbol.getName(),
            decledSource?.fileName.replace(process.cwd() + "/", ""),
          );
        }
        // console.log(
        //   "  --- decledSource ---",
        //   symbol.getName(),
        //   decledSource?.fileName,
        // );
      }
      break;
      // break;
    }

    if (flag === SymbolFlags.ValueModule) {
      console.log("--- ValueModule ---", symbolNames);
      // break;
    }

    // if (flag === SymbolFlags.FunctionExcludes) {
    //   console.log("--- FunctionExcludes ---", symbols);
    //   break;
    // }
  }

  // console.log(rootFile);
  // const locals = checker.getSymbolsInScope(
  //   rootFile!,
  //   SymbolFlags.BlockScopedVariable,
  // );
  // const locals = checker.getSymbolsInScope(
  //   rootFile!,
  //   SymbolFlags.BlockScoped,
  // );
  // // rootFile.
  // console.log(locals.map((s) => s.name));
});

test.skip("finder: find all locals", () => {
  const { service, normalizePath, snapshotManager } =
    createTestLanguageService();
  snapshotManager.writeFileSnapshot(normalizePath("src/locals.ts"), code);

  const program = service.getProgram()!;
  const checker = program.getTypeChecker();

  const rootFile = program.getSourceFile(normalizePath("src/locals.ts"))!;
  const getLocalSymbols = createGetLocalSymbolsOfFile(checker, rootFile!);

  const rootBlockScoped = checker.getSymbolsInScope(
    rootFile,
    SymbolFlags.BlockScoped,
  );
  console.log(
    "rootBlockScoped",
    rootBlockScoped.length,
    rootBlockScoped.map((f) => f.name),
  );

  // const getSymbolNames = (flags: SymbolFlags) => {
  //   return checker.getSymbolsInScope(
  //     rootFile!,
  //     flags,
  //   )
  //     .filter((sym) => {
  //       if (sym.valueDeclaration) return false;
  //       if (sym.declarations) {
  //         const source = sym.declarations[0].getSourceFile();
  //         if (source.fileName.includes("/node_modules/")) return false;
  //         return true;
  //       }
  //       return true;
  //     })
  //     .map((s) => s.name);
  // };
  // const getSymbols = (flags: SymbolFlags, filters: string[] = []) => {
  //   return checker.getSymbolsInScope(
  //     rootFile!,
  //     flags,
  //   );
  // };
  const funcs = getLocalSymbols(SymbolFlags.Function);
  for (const func of funcs) {
    // console.log("func", func);
    // const locals = checker.getSymbolsInScope(
    //   func.valueDeclaration!,
    //   SymbolFlags.BlockScoped,
    // );
    // console.log("locals", locals);
    console.log(
      "func",
      func.name,
      stripCwd(func.valueDeclaration?.getSourceFile()?.fileName || ""),
      // func.valueDeclaration?.getSourceFile()?.fileName,
    );
    const scan = createScanner(checker, rootFile, `:: ${func.name}: `);
    // scan(func.valueDeclaration!);
    // console.log("func", func.name, func);
    if (
      func.valueDeclaration && isFunctionDeclaration(func.valueDeclaration) &&
      func.valueDeclaration.body
    ) {
      const blockScoped = checker.getSymbolsInScope(
        func.valueDeclaration.body!,
        SymbolFlags.BlockScoped,
      );
      // console.log(
      //   "reachable:functionBlockScoped",
      //   blockScoped.length,
      //   blockScoped.map((f) => f.name),
      // );

      func.valueDeclaration.body.forEachChild((x) => {
        if (isVariableStatement(x)) {
          for (const decl of x.declarationList.declarations) {
            // console.log("functionBlockScoped", decl.name.getText());
            // const symbol = checker.getSymbolAtLocation(decl.name);
            // const shorthanded = checker.getShorthandAssignmentValueSymbol(
            //   decl,
            // );
            // // console.log("functionBlockScoped", symbol);
            // const refs = service.findReferences(
            //   normalizePath("src/locals.ts"),
            //   decl.name.getStart(),
            // );

            const shorthanded = checker.getShorthandAssignmentValueSymbol(
              decl.parent,
            );
            console.log("--shorthand", shorthanded);

            const renames = service.findRenameLocations(
              normalizePath("src/locals.ts"),
              decl.name.getStart(),
              false,
              false,
              {},
            );

            console.log(
              `${func.name} => ${decl.name.getText()}`,
              renames,
              "--[textSpan]",
              rootFile.text.substring(
                renames![0].textSpan.start,
                renames![0].textSpan.start + renames![0].textSpan.length,
              ),
              // "--[contextSpan]",
              // rootFile.text.substring(
              //   renames![0].contextSpan!.start,
              //   renames![0].contextSpan!.start +
              //     renames![0].contextSpan!.length,
              // ),
              // "---refs",
              // refs,
              // renames![0].
              // "-- short",
              // shorthanded,
            );
            for (const rename of renames!) {
              const x = service.findReferences(
                normalizePath("src/locals.ts"),
                rename.textSpan.start,
              );
              // console.log("rename", rename.textSpan.start, x);

              // get symbol or node at location
              // const childNode = rootFile.getChildAt(rename.textSpan.start);
              // const symbol = checker.getSymbolAtLocation(rename.textSpan.start);
              // console.log("rename childNode is shorthanded", childNode);
              // if (childNode) {
              //   console.log(
              //     "childNode",
              //     childNode.getText(),
              //     childNode.kind,
              //     childNode.pos,
              //     childNode.end,
              //   );
              // }
              // checker
              // rootFile.
              // check is rewrite target short handed
              // const renameSymbol = checker.getNode
            }
            // const
            // console.log(
            //   1,
            //   "--- [textSpan:1]",
            //   rootFile.text.substring(
            //     renames![0].textSpan.start,
            //     renames![0].textSpan.start + renames![0].textSpan.length,
            //   ),
            //   // renames![0].
            //   // shorthanded,
            // );
          }
          // console.log("functionBlockScoped", x.declarationList.declarations);
        }
        // if (isFunctionDeclaration(x)) {
        //   console.log("functionBlockScoped", x.name);
        // }
      });

      // const values = checker.getSymbolsInScope(
      //   func.valueDeclaration.body!,
      //   SymbolFlags.,
      // );
      // console.log(
      //   "functionBlockScoped",
      //   blockScoped.length,
      //   blockScoped.map((f) => f.name),
      // );

      // scan(func.valueDeclaration);
    }

    // if (func.valueDeclaration) {
    //   scan(
    //     func.valueDeclaration,
    //   );
    // }
    // scan(checker, , `:: ${func.name}: `)
  }
  // console.log("x", getLocalSymbols(SymbolFlags.));

  // console.log("x", getSymbolNames(SymbolFlags.ExportValue));

  // console.log("x", getSymbolNames(SymbolFlags.Function));
  // expect(getSymbolNames(SymbolFlags.FunctionScopedVariable)).toEqual([
  //   "f",
  //   "g",
  // ]);
});

const isSymbolInFile = (sourceFile: SourceFile, symbol?: Symbol) => {
  return symbol?.valueDeclaration?.getSourceFile() === sourceFile;
};

const stripCwd = (path: string) => path.replace(process.cwd() + "/", "");

const createScanner = (
  checker: TypeChecker,
  sourceFile: SourceFile,
  logPrefix = "::",
) => {
  // const getLocals = createGetLocalSymbolsOfFile(checker, sourceFile);
  return (node: Node) => {
    const keys = Object.keys(SymbolFlags);
    for (const flags of keys) {
      const flag = SymbolFlags[flags as keyof typeof SymbolFlags];
      if (typeof flag !== "number") {
        continue;
      }
      try {
        const symbolNames = checker.getSymbolsInScope(
          node,
          flag,
        )
          .filter((sym) => isSymbolInFile(sourceFile, sym))
          .map((s) => s.name);
        console.log(logPrefix, SymbolFlags[flag], symbolNames.length);
      } catch (e) {
        console.log(logPrefix, SymbolFlags[flag], "error", e.message);
      }
    }
  };
};

const createGetLocalSymbolsOfFile =
  (checker: TypeChecker, sourceFile: SourceFile) => (flags: SymbolFlags) => {
    return checker.getSymbolsInScope(
      sourceFile,
      flags,
    )
      .filter((sym) => isSymbolInFile(sourceFile, sym));
  };

// memo va
