import { expect, test } from "vitest";
import ts from "typescript";
import path from "node:path";

import { createInMemoryLanguageServiceHost } from "./services";

test("in memory language service: life cycle update", () => {
  const projectPath = path.join(__dirname, "../examples");
  const tsconfig = ts.readConfigFile(
    path.join(projectPath, "tsconfig.json"),
    ts.sys.readFile,
  );
  const options = ts.parseJsonConfigFileContent(
    tsconfig.config,
    ts.sys,
    projectPath,
  );
  const registory = ts.createDocumentRegistry();
  const serviceHost = createInMemoryLanguageServiceHost(
    projectPath,
    options.fileNames,
    options.options,
  );
  const languageService = ts.createLanguageService(
    serviceHost,
    registory,
  );

  const expandPath = (fname: string) => {
    if (fname.startsWith("/")) {
      return fname;
    }
    const root = projectPath;
    return path.join(root, fname);
  };

  const program1 = languageService.getProgram();
  expect(
    languageService.getSemanticDiagnostics(expandPath("src/index.ts")).length,
  ).toBe(1);

  const snapshotManager = serviceHost.getSnapshotManager(registory);
  const prevSource = languageService.getProgram()?.getSourceFile(
    expandPath("src/index.ts"),
  );
  const newSource = snapshotManager.writeFileSnapshot(
    "src/index.ts",
    "const x: number = 1;",
  );

  const nextSource = languageService.getProgram()?.getSourceFile(
    expandPath("src/index.ts"),
  );

  expect(prevSource === nextSource).toBe(false);
  expect(nextSource === newSource).toBe(true);
  const updated = snapshotManager.readFileSnapshot("src/index.ts");
  expect(updated).toBe("const x: number = 1;");
  expect(updated).toBe(newSource.getText());

  const program2 = languageService.getProgram();
  expect(program1 === program2).toBe(false);

  expect(
    languageService.getSemanticDiagnostics(expandPath("src/index.ts")).length,
  ).toBe(0);

  const program3 = languageService.getProgram();
  expect(program2 === program3).toBe(true);
});
