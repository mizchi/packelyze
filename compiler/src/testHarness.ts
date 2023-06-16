import {
  LanguageService,
  Program,
  createDocumentRegistry,
  createLanguageService,
  parseJsonConfigFileContent,
  readConfigFile,
  sys,
} from "typescript";
import path from "node:path";
import { createInMemoryLanguageServiceHost } from "./services";

// let lastService: LanguageService | undefined = undefined;
// let oldRegistry = createDocumentRegistry();

export function createTestLanguageService(
  projectPath: string = path.join(__dirname, "../examples"),
) {
  const tsconfig = readConfigFile(
    path.join(projectPath, "tsconfig.json"),
    sys.readFile,
  );
  const options = parseJsonConfigFileContent(
    tsconfig.config,
    sys,
    projectPath,
  );
  const registory =  createDocumentRegistry();
  const serviceHost = createInMemoryLanguageServiceHost(
    projectPath,
    options.fileNames,
    options.options,
  );
  const snapshotManager = serviceHost.getSnapshotManager(registory);
  const service = createLanguageService(
    serviceHost,
    registory,
  );
  // oldRegistry = registory;
  // lastProgram = service.getProgram();
  // lastService = service;
  return {
    snapshotManager,
    service,
    host: serviceHost,
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
