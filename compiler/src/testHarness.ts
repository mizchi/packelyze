import {
  DocumentRegistry,
  LanguageService,
  Program,
  createDocumentRegistry,
  createLanguageService,
  parseJsonConfigFileContent,
  readConfigFile,
  sys,
} from "typescript";
import path from "node:path";
import { IncrementalLanguageServiceHost, createIncrementalLanguageService, createIncrementalLanguageServiceHost } from "./services";

let lastRegistry: DocumentRegistry | undefined = undefined;
let lastHost: IncrementalLanguageServiceHost | undefined = undefined;

export function createTestLanguageService(
  projectPath: string = path.join(__dirname, "../examples"),
  revertRootFiles = true,
) {
  // console.time("createTestLanguageService");
  const tsconfig = readConfigFile(
    path.join(projectPath, "tsconfig.json"),
    sys.readFile,
  );
  const options = parseJsonConfigFileContent(
    tsconfig.config,
    sys,
    projectPath,
  );

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
  const registry = createDocumentRegistry();
  const host = createIncrementalLanguageServiceHost(
    projectPath,
    options.fileNames,
    options.options,
    lastHost,
  );
  // const snapshotManager = serviceHost.getSnapshotManager(registory);
  const service = createIncrementalLanguageService(
    host,
    registry,
  );
  lastRegistry = registry;
  lastHost = host;
  // console.timeEnd("createTestLanguageService");
  return {
    // snapshotManager,
    service,
    host,
    registory: registry,
    normalizePath(fname: string) {
      if (fname.startsWith("/")) {
        return fname;
      }
      const root = projectPath;
      return path.join(root, fname); //
    },
  };
}
