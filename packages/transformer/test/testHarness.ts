import path from "node:path";
import ts from "typescript";
import {
  type IncrementalLanguageServiceHost,
  createIncrementalLanguageService,
  createIncrementalLanguageServiceHost,
} from "../src";

let lastRegistry: ts.DocumentRegistry | undefined = undefined;
let lastHost: IncrementalLanguageServiceHost | undefined = undefined;

export function initTestLanguageServiceWithFiles(
  files: Record<string, string>,
  projectPath: string = path.join(__dirname, "../fixtures/minimum"),
  revertRootFiles = true,
) {
  const testLsp = createTestLanguageService(projectPath, revertRootFiles);
  for (const [file, content] of Object.entries(files)) {
    testLsp.service.writeSnapshotContent(testLsp.normalizePath(file), content);
  }
  testLsp.service.getProgram()?.getTypeChecker();
  return testLsp;
}

export function createTestLanguageService(
  projectPath: string = path.join(__dirname, "../fixtures/minimum"),
  revertRootFiles = true,
) {
  // console.time("createTestLanguageService");
  const tsconfig = ts.readConfigFile(path.join(projectPath, "tsconfig.json"), ts.sys.readFile);
  const options = ts.parseJsonConfigFileContent(tsconfig.config, ts.sys, projectPath);

  // release old cache
  if (revertRootFiles && lastRegistry && lastHost) {
    const cache = lastHost.getInMemoryCache();
    const key = lastRegistry.getKeyForCompilationSettings(options.options);
    for (const fname of options.fileNames) {
      if (!fname.startsWith(projectPath)) {
        continue;
      }
      if (cache.fileSnapshots.has(fname)) {
        cache.fileSnapshots.delete(fname);
      }
      if (cache.fileContents.has(fname)) {
        cache.fileContents.delete(fname);
      }
      if (cache.fileVersions.has(fname)) {
        cache.fileVersions.delete(fname);
      }
      // lastRegistry.releaseDocumentWithKey(fname as any, key);
    }
    cache.virtualExistedDirectories.clear();
  }
  // const registory = lastRegistry ?? createDocumentRegistry();
  const registory = ts.createDocumentRegistry();
  const host = createIncrementalLanguageServiceHost(projectPath, options.fileNames, options.options, lastHost);
  const service = createIncrementalLanguageService(host, registory);
  lastRegistry = registory;
  lastHost = host;
  // console.timeEnd("createTestLanguageService");
  return {
    // snapshotManager,
    projectPath,
    service,
    host,
    registory,
    normalizePath(fname: string) {
      if (fname.startsWith("/")) {
        return fname;
      }
      const root = projectPath;
      return path.join(root, fname); //
    },
  };
}

// To check oneshot ast analyze
let oldOneshotProgram: ts.Program | undefined = undefined;
export function createOneshotTestProgram(
  indexCode: string,
  projectPath: string = path.join(__dirname, "../fixtures/minimum"),
): { file: ts.SourceFile; program: ts.Program; checker: ts.TypeChecker } {
  const tsconfig = ts.readConfigFile(path.join(projectPath, "tsconfig.json"), ts.sys.readFile);
  const options = ts.parseJsonConfigFileContent(tsconfig.config, ts.sys, projectPath);

  const host = ts.createCompilerHost(options.options);
  host.getCurrentDirectory = () => projectPath;
  host.readFile = (fname) => {
    const resolved = fname.startsWith("/") ? fname : path.join(projectPath, fname);
    if (resolved === path.join(projectPath, "index.ts")) {
      return indexCode;
    }
    return ts.sys.readFile(resolved);
  };
  // host.reda
  const program = ts.createProgram([path.join(projectPath, "index.ts")], options.options, host, oldOneshotProgram);
  const file = program.getSourceFile(path.join(projectPath, "index.ts"))!;
  oldOneshotProgram = program;
  return {
    file,
    program: program,
    checker: program.getTypeChecker(),
  };
}
