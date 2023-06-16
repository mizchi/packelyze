import ts from "typescript";
import fs from "node:fs";
import path from "node:path";

export type SnapshotManager = {
  readFileSnapshot(fileName: string): string | undefined;
  writeFileSnapshot(fileName: string, content: string): ts.SourceFile;
};

export interface InMemoryLanguageServiceHost extends ts.LanguageServiceHost {
  getSnapshotManager: (
    registory: ts.DocumentRegistry,
  ) => SnapshotManager;
  setDebug(state: boolean): void;
}

export function createInMemoryLanguageServiceHost(
  projectRoot: string,
  fileNames: string[],
  options: ts.CompilerOptions,
): InMemoryLanguageServiceHost {
  // read once, write on memory
  const fileContents = new Map<string, string>();
  const fileSnapshots = new Map<string, ts.IScriptSnapshot>();
  const fileVersions = new Map<string, number>();
  const fileDirtySet = new Map<string, [start: number, end: number] | true>();

  const expandPath = (fname: string) => {
    if (fname.startsWith("/")) {
      return fname;
    }
    return path.join(projectRoot, fname);
  };

  const getSnapshotManagerInternal: (
    registory: ts.DocumentRegistry,
  ) => SnapshotManager = (registory: ts.DocumentRegistry) => {
    return {
      readFileSnapshot(fileName: string) {
        fileName = expandPath(fileName);
        debugLog("[readFileSnapshot]", fileName);
        if (fileContents.has(fileName)) {
          return fileContents.get(fileName) as string;
        }
        return ts.sys.readFile(fileName);
      },
      writeFileSnapshot(
        fileName: string,
        content: string,
        range?: [number, number],
      ) {
        fileName = expandPath(fileName);
        const nextVersion = (fileVersions.get(fileName) || 0) + 1;
        // fileVersions.set(fileName, nextVersion);
        fileContents.set(fileName, content);
        debugLog(
          "[writeFileSnapshot]",
          fileName,
          nextVersion,
          content.length,
        );
        // TODO: compose range
        fileDirtySet.set(fileName, range || true);
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

  let debug = false;

  const setDebug = (state: boolean) => {
    debug = state;
  };

  const debugLog = (...args: any[]) => {
    if (debug) {
      console.log(...args);
    }
  };

  const serviceHost: InMemoryLanguageServiceHost = {
    setDebug,
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
      // debugLog("[readFile]", fname);
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
      debugLog("[writeFile:mock]", fileName, content.length);
      // fileContents.set(fileName, content);
      // const version = fileVersions.get(fileName) || 0;
      // fileVersions.set(fileName, version + 1);
    },
    getScriptSnapshot: (fileName) => {
      fileName = expandPath(fileName);
      if (fileName.includes("src/index.ts")) {
        debugLog("[getScriptSnapshot]", fileName);
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
        // TODO: is this correct?
        // {
        //   const rangeOrTrue = fileDirtySet.get(fileName)!;
        //   if (rangeOrTrue !== true) {
        //     const snapshot = ts.ScriptSnapshot.fromString(raw);
        //   } else {

        //   }
        // }
        fileVersions.set(fileName, current + 1);
      }
      return (fileVersions.get(fileName) || 0).toString();
    },
    getSnapshotManager: getSnapshotManagerInternal,
  };
  return serviceHost;
}
