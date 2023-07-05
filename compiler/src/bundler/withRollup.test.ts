import { FindRenameLocations, getRenamedChanges } from "./../transformer/renamer";
// import { exp } from './../analyzer/analyzer.test';
// import { withRollup } from './withRollup';
import { test, expect } from "vitest";
import { rollup } from "rollup";
import ts from "typescript";
import { createTestLanguageService } from "../__tests/testHarness";
import { IncrementalLanguageService } from "../services";
import { createGetMangleRenameItems } from "../transformer/mangler";

test.skip("withRollup", async () => {
  const { service, normalizePath, host } = createTestLanguageService();
  const files = {
    "src/index.ts": `
      type Local = {
        local: number;
      }
      type Pub = {
        pub: number;
      }
      function fff(): Pub {
        const fLocal: Local = {local: 1};
        return {
          pub: fLocal.local
        }
      }
      export const x = fff();
    `,
  };
  service.writeSnapshotContent("src/index.ts", files["src/index.ts"]);
  const checker = service.getProgram()!.getTypeChecker();

  // const root = service.getProgram()!.getSourceFile("src/index.ts")!;
  let getRenameItemsForFile = createGetMangleRenameItems(
    checker,
    service.findRenameLocations,
    service.getCurrentSourceFile,
    "src/index.ts",
  );

  const fileNames = service.getProgram()!.getRootFileNames();

  const renameItems = fileNames.flatMap(getRenameItemsForFile);
  getRenamedChanges(renameItems, service.readSnapshotContent, normalizePath);

  // for (const fileName of fileNames) {
  //   // const sourceFile = service.getProgram()!.getSourceFile(fileName)!;
  //   const renameItems = getRenameItemsForFile(fileName);

  //   console.log(renameItems);
  // }

  const bundle = await rollup({
    input: "src/index.ts",
    plugins: [
      {
        name: "test",
        options(options) {
          // const getMangleRenameItems =  createGetMangleRenameItems(service, checker, node);
          // on options
          console.log("on-options", options);
        },
        resolveId(id, importer) {
          const nid = normalizePath(id);
          if (host.fileExists(nid)) {
            return nid;
          }
          // const id = service.resolveModuleId(importer, id);
        },
        load(id) {
          const nid = normalizePath(id);
          if (host.fileExists(nid)) {
            return host.readFile(nid);
          }
        },
        transform(code, id) {
          const nid = normalizePath(id);
          if (host.fileExists(nid)) {
            // const result = (nid, code);
            const result = ts.transpileModule(code, {
              fileName: nid,
              compilerOptions: {
                target: ts.ScriptTarget.ESNext,
                module: ts.ModuleKind.ESNext,
                moduleResolution: ts.ModuleResolutionKind.Bundler,
                esModuleInterop: true,
                allowSyntheticDefaultImports: true,
                strict: true,
                noImplicitAny: true,
              },
            });
            return result.outputText;
          }
        },
      },
    ],
  });

  const { output } = await bundle.generate({
    format: "esm",
  });

  console.log(output[0].code);
  // expect(output[0].code).toEqualFormatted(`
  //   const x = 1;
  //   export function f() {
  //       return internal();
  //   }
  //   function internal() {
  //       return x;
  //   }
  //   export const x$1 = f();
  // `);
});
