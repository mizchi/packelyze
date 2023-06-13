// import ts from "typescript/lib/tsserverlibrary.js";
import ts from "typescript";
import fs from "node:fs";
import path from "node:path";

// const tsconfig = ts.readConfigFile("./tsconfig.json", ts.sys.readFile);
// const options = ts.parseJsonConfigFileContent(tsconfig.config, ts.sys, "./");
// const defaultHost = ts.createCompilerHost(options.options);

type SnapshotManager = {
  readFileSnapshot(fileName: string): string | undefined;
  writeFileSnapshot(fileName: string, content: string): ts.SourceFile;
};

export interface InMemoryLanguageServiceHost extends ts.LanguageServiceHost {
  getSnapshotManager: (
    registory: ts.DocumentRegistry,
  ) => SnapshotManager;
}

// const expandPath = (fname: string) => {
//   if (fname.startsWith("/")) {
//     return fname;
//   }
//   const root = process.cwd();
//   return path.join(root, fname);
// };

export function applyRenameLocations(
  code: string,
  toName: string,
  renameLocations: readonly ts.RenameLocation[],
) {
  let current = code;
  let offset = 0;
  for (const loc of renameLocations) {
    const start = loc.textSpan.start;
    const end = loc.textSpan.start + loc.textSpan.length;
    current = current.slice(0, start + offset) + toName +
      current.slice(end + offset);
    offset += toName.length - (end - start);
  }
  return current;
}

export function createInMemoryLanguageServiceHost(
  fileNames: string[],
  options: ts.CompilerOptions,
  expandPath: (fname: string) => string,
): InMemoryLanguageServiceHost {
  // read once, write on memory
  const fileContents = new Map<string, string>();
  const fileSnapshots = new Map<string, ts.IScriptSnapshot>();
  const fileVersions = new Map<string, number>();
  const fileDirtySet = new Set<string>();

  const getSnapshotManagerInternal: (
    registory: ts.DocumentRegistry,
  ) => SnapshotManager = (registory: ts.DocumentRegistry) => {
    return {
      readFileSnapshot(fileName: string) {
        fileName = expandPath(fileName);
        console.log("[readFileSnapshot]", fileName);
        if (fileContents.has(fileName)) {
          return fileContents.get(fileName) as string;
        }
        return ts.sys.readFile(fileName);
      },
      writeFileSnapshot(fileName: string, content: string) {
        fileName = expandPath(fileName);
        const nextVersion = (fileVersions.get(fileName) || 0) + 1;
        // fileVersions.set(fileName, nextVersion);
        fileContents.set(fileName, content);
        console.log(
          "[writeFileSnapshot]",
          fileName,
          nextVersion,
          content.length,
        );
        fileDirtySet.add(fileName);
        const newSource = registory.updateDocument(
          fileName,
          serviceHost,
          ts.ScriptSnapshot.fromString(content),
          String(nextVersion),
        );
        return newSource;
      },
    };
  };

  const defaultHost = ts.createCompilerHost(options);

  const serviceHost: InMemoryLanguageServiceHost = {
    getDefaultLibFileName: defaultHost.getDefaultLibFileName,
    fileExists: ts.sys.fileExists,
    readDirectory: ts.sys.readDirectory,
    directoryExists: ts.sys.directoryExists,
    getDirectories: ts.sys.getDirectories,
    getCurrentDirectory: defaultHost.getCurrentDirectory,
    getScriptFileNames: () => fileNames,
    getCompilationSettings: () => options,
    readFile: (fname, encode) => {
      fname = expandPath(fname);
      // console.log("[readFile]", fname);
      if (fileContents.has(fname)) {
        return fileContents.get(fname) as string;
      }
      const rawFileResult = ts.sys.readFile(fname, encode);
      if (rawFileResult) {
        fileContents.set(fname, rawFileResult);
        fileVersions.set(
          fname,
          (fileVersions.get(fname) || 0) + 1,
        );
      }
      return rawFileResult;
    },
    writeFile: (fileName, content) => {
      fileName = expandPath(fileName);
      console.log("[writeFile:mock]", fileName, content.length);
      // fileContents.set(fileName, content);
      // const version = fileVersions.get(fileName) || 0;
      // fileVersions.set(fileName, version + 1);
    },
    getScriptSnapshot: (fileName) => {
      fileName = expandPath(fileName);
      if (fileName.includes("src/index.ts")) {
        console.log("[getScriptSnapshot]", fileName);
      }
      if (fileSnapshots.has(fileName)) {
        return fileSnapshots.get(fileName)!;
      }
      const contentCache = fileContents.get(fileName);
      if (contentCache) {
        const newSnapshot = ts.ScriptSnapshot.fromString(contentCache);
        fileSnapshots.set(fileName, newSnapshot);
        return newSnapshot;
      }
      if (!fs.existsSync(fileName)) return;
      const raw = ts.sys.readFile(fileName, "utf8")!;
      const snopshot = ts.ScriptSnapshot.fromString(raw);
      fileSnapshots.set(fileName, snopshot);
      return snopshot;
    },
    getScriptVersion: (fileName) => {
      fileName = expandPath(fileName);
      const isDirty = fileDirtySet.has(fileName);
      if (isDirty) {
        const current = fileVersions.get(fileName) || 0;
        fileDirtySet.delete(fileName);
        fileVersions.set(fileName, current + 1);
      }
      return (fileVersions.get(fileName) || 0).toString();
    },
    getSnapshotManager: getSnapshotManagerInternal,
  };
  return serviceHost;
}
