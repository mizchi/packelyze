// import ts, { LanguageService, ScriptSnapshot, SourceFile, TextChangeRange, createDocumentRegistry } from "typescript";
import ts from "typescript";
import fs from "node:fs";
import path from "node:path";
import { createLogger, Logger } from "./logger";
import { blue, green } from 'colorette';

export interface IncrementalSnapshot extends ts.IScriptSnapshot {
  /** If snapshot analyzed by typeChecker, it will be true */
  loaded?: boolean;
  incremental?: boolean;
}

export interface IncrementalLanguageServiceHost extends ts.LanguageServiceHost {
  readSnapshot(fileName: string): IncrementalSnapshot | undefined;
  readSnapshotContent(fileName: string): string | undefined;
  writeSnapshot(fileName: string, snapshot: IncrementalSnapshot): void;
  writeSnapshotContent(fileName: string, content: string, range: [number, number] | undefined): void;
  getInMemoryCache(): InMemoryCache;
  dispose(): void;
  logger: Logger;
}

export interface IncrementalLanguageService extends ts.LanguageService {
  getCurrentSourceFile(fileName: string): ts.SourceFile | undefined;
  readSnapshot(fileName: string): IncrementalSnapshot | undefined;
  readSnapshotContent(fileName: string): string | undefined;
  writeSnapshot(fileName: string, snapshot: IncrementalSnapshot): void;
  writeSnapshotContent(fileName: string, content: string): void;
  deleteSnapshot(fileName: string): void;
  normalizePath(fileName: string): string;
  logger: Logger
}

export type InMemoryCache = {
  fileVersions: Map<string, number>;
  fileContents: Map<string, string | undefined>;
  fileSnapshots: Map<string, IncrementalSnapshot | undefined>;
  virtualExistedDirectories: Set<string>;
}

export function createIncrementalLanguageService(
  host: IncrementalLanguageServiceHost,
  documentRegistry: ts.DocumentRegistry = ts.createDocumentRegistry(),
  debug?: boolean,
): IncrementalLanguageService {
  const colorlize = (item: any) => {
    if (typeof item === "string") {
      return green(item);
    }
    return item;
  }
  const log = createLogger("[Srvs]", debug, stripRoot(host.getCurrentDirectory()), colorlize);
  
  const projectRoot = host.getCurrentDirectory();
  const normalizePath = (fname: string) => {
    if (fname.startsWith("/")) {
      return fname;
    }
    return path.join(projectRoot, fname);
  };

  const languageService = ts.createLanguageService(
    host,
    documentRegistry,
  );
  const getCurrentSourceFile = (fileName: string) => {
    fileName = normalizePath(fileName);
    log("getCurrentSourceFile", fileName);
    // touch file to script snapshot updating
    // console.time("getCurrentSourceFile");
    const program = languageService.getProgram();
    const _checker = program?.getTypeChecker();
    return languageService.getProgram()?.getSourceFile(fileName);
  };
  const writeSnapshotContent = (fileName: string, content: string) => {
    fileName = normalizePath(fileName);
    log("writeSnapshotContent", fileName, `${content.length}bytes`);
    host.writeSnapshotContent(fileName, content, undefined);
  };

  const writeSnapshot = (fileName: string, snapshot: IncrementalSnapshot) => {
    fileName = normalizePath(fileName);
    log("writeSnapshot", fileName, `${snapshot.getLength()}bytes`);
    host.writeSnapshot(fileName, snapshot);
  };

  function readSnapshot(fileName: string) {
    log("readSnapshot", fileName);
    return host.readSnapshot(fileName);
  };

  function readSnapshotContent(fileName: string) {
    log("readSnapshot", fileName);
    return host.readSnapshotContent(fileName);
  };

  function deleteSnapshot(fileName: string) {
    log("deleteSnapshot", fileName);
  };
  return {
    ...languageService,
    getCurrentSourceFile,
    // getCurrentSnapshot,
    deleteSnapshot,
    readSnapshot,
    readSnapshotContent,
    writeSnapshotContent,
    writeSnapshot,
    normalizePath,
    logger: log,
  };
}

const stripRoot = (rootDir: string) => (item: any)=> {
  if (typeof item === "string" && item.startsWith(rootDir)) {
    return item.replace(rootDir + "/", '~/');
  } else {
    return item;
  }
}

export function createIncrementalLanguageServiceHost(
  projectRoot: string,
  fileNames: string[] = [],
  options?: ts.CompilerOptions,
  oldHost?: IncrementalLanguageServiceHost,
  debug = false,
): IncrementalLanguageServiceHost {
  const colorlize = (item: any) => {
    if (typeof item === "string") {
      return blue(item);
    }
    return item;
  }

  const log = createLogger("[Host]", debug, stripRoot(projectRoot), colorlize);

  // Setup compiler options
  const tsconfigPath = ts.findConfigFile(
    path.join(projectRoot, "tsconfig.json"),
    ts.sys.fileExists,
  )!;
  const tsconfig = ts.readConfigFile(
    tsconfigPath,
    ts.sys.readFile,
  );
  if (options == null) {
    const parsed = ts.parseJsonConfigFileContent(
      tsconfig.config,
      ts.sys,
      projectRoot,
    );
    options = parsed.options;
    if (fileNames.length === 0) {
      fileNames = parsed.fileNames;
    }
  }

  const cache = oldHost?.getInMemoryCache();
  const fileContents = cache?.fileContents ?? new Map<string, string | undefined>();
  const fileSnapshots = cache?.fileSnapshots ?? new Map<string, IncrementalSnapshot | undefined>();
  const fileVersions = cache?.fileVersions ?? new Map<string, number>();
  const virtualExistedDirectories = cache?.virtualExistedDirectories ?? new Set<string>();

  // ensure virtual file directories
  function addVirtualExistedDirectories(fileName: string) {
    // log("addVirtualExistedDirectories", fileName);
    const dirPath = path.dirname(fileName);
    const paths = dirPath.split(path.sep);
    let current = "/";
    let p = paths.shift();
    while (p != null) {
      current = path.join(current, p);
      if (!virtualExistedDirectories.has(current)) {
        log("addVirtualExistedDirectories:new", current);
        virtualExistedDirectories.add(current);
      }
      p = paths.shift();
    }
  }

  const getCurrentDirectory = () => projectRoot;

  const normalizePath = (fname: string) => {
    if (fname.startsWith("/")) {
      return fname;
    }
    return path.join(projectRoot, fname);
  };

  function readSnapshot(
    fileName: string
  ): IncrementalSnapshot | undefined {
    fileName = normalizePath(fileName);
    log("readSnapshot", fileName);
    if (fileSnapshots.has(fileName)) {
      const snapshot = fileSnapshots.get(fileName);
      return snapshot;
    }
  };

  function readSnapshotContent(
    fileName: string
  ) {
    fileName = normalizePath(fileName);
    log("readFileSnapshot", fileName);
    if (fileContents.has(fileName)) {
      return fileContents.get(fileName) as string;
    }
    return ts.sys.readFile(fileName);
  };

  function writeSnapshot(
    fileName: string,
    snapshot: IncrementalSnapshot,
  ) {
    fileName = normalizePath(fileName);
    log("writeSnapshot", fileName);
    const nextVersion = (fileVersions.get(fileName) || 0) + 1;
    const content = snapshot.getText(0, snapshot.getLength());
    // TODO: merge snapshot range
    fileVersions.set(fileName, nextVersion);
    fileContents.set(fileName, content);
    fileSnapshots.set(fileName, snapshot);
    currentFileNames = [...currentFileNames, fileName];
  }
  function writeSnapshotContent(
    fileName: string,
    content: string,
    range: [number, number] | undefined,
  ) {
    fileName = normalizePath(fileName);
    log("writeSnapshotContent", fileName);
    addVirtualExistedDirectories(fileName);
    const prev = fileSnapshots.get(fileName);
    const snapshot = createIncrementalSnapshot(content, range, prev);
    writeSnapshot(fileName, snapshot);
    return;
  };

  const defaultHost = ts.createCompilerHost(options);

  let currentFileNames = [...fileNames];

  const getInMemoryCache = (): InMemoryCache => {
    return {
      fileVersions,
      fileContents,
      fileSnapshots,
      virtualExistedDirectories,
    };
  }
  let disposed = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    currentFileNames = [];
    fileContents.clear();
    fileSnapshots.clear();
    fileVersions.clear();
    virtualExistedDirectories.clear();
  }
  const serviceHost: IncrementalLanguageServiceHost = {
    dispose,
    readSnapshotContent,
    readSnapshot,
    writeSnapshot,
    getInMemoryCache,
    // readCurrentSnapshot,
    // readCurrentSnapshotContent,
    writeSnapshotContent,
    getDefaultLibFileName: defaultHost.getDefaultLibFileName,
    fileExists: (fileName: string) => {
      if (fileName.startsWith(projectRoot)) {
        log("fileExists", fileName);
      }
      if (fileContents.has(fileName)) {
        return !!fileContents.get(fileName);
      }
      return ts.sys.fileExists(normalizePath(fileName));
    },
    readDirectory: (dirPath: string, extensions) => {
      dirPath = normalizePath(dirPath);
      log("readDirectory", dirPath);
      const prefixedFiles = [...fileContents.keys()].filter((fname) => fname.startsWith(dirPath));
      if (prefixedFiles.length > 0) {
        const filesUnderDir = prefixedFiles
          .filter((fname) => {
            const relative = fname.replace(dirPath, "");
            return relative.indexOf("/") === relative.lastIndexOf("/");
          })
          .filter((fname) => {
            if (!extensions) return true;
            for (const ext of extensions) {
              if (fname.endsWith(ext)) {
                return true;
              }
            }
          })
          .map((fname) => fname.replace(dirPath + "/", ""));
        return filesUnderDir;
      }
      return ts.sys.readDirectory(dirPath);
    },
    directoryExists: (dirPath) => {
      dirPath = normalizePath(dirPath);
      if (virtualExistedDirectories.has(dirPath)) {
        return true;
      }
      return ts.sys.directoryExists(dirPath);
    },
    getDirectories: ts.sys.getDirectories,
    getCurrentDirectory: getCurrentDirectory,
    getScriptFileNames: () => currentFileNames,
    getCompilationSettings: () => options!,
    readFile: (fname, encode) => {
      fname = normalizePath(fname);
      // debugLog("[readFile]", fname);
      if (fileContents.has(fname)) {
        return fileContents.get(fname) as string;
      }
      const rawFileResult = ts.sys.readFile(fname, encode);
      if (rawFileResult) {
        fileContents.set(fname, rawFileResult);
        fileVersions.set(
          fname,
          (fileVersions.get(fname) ?? 0),
        );
        // write cache on init
        // const snapshot = ts.ScriptSnapshot.fromString(rawFileResult) as IncrementalSnapshot;
        const snapshot = createIncrementalSnapshot(rawFileResult);
        fileSnapshots.set(fname, snapshot);
      }
      return rawFileResult;
    },
    writeFile: (fileName, content) => {
      fileName = normalizePath(fileName);
      log("writeFile:dummy", fileName, `${content.length}bytes`);
      // fileContents.set(fileName, content);
      // const version = fileVersions.get(fileName) || 0;
      // fileVersions.set(fileName, version + 1);
    },
    getScriptSnapshot: (fileName) => {
      fileName = normalizePath(fileName);
      if (fileName.includes("src/index.ts")) {
        log("getScriptSnapshot", fileName);
      }
      if (fileSnapshots.has(fileName)) {
        const snapshot = fileSnapshots.get(fileName)!;
        // console.log("getScriptSnapshot---", fileName, snapshot.loaded);
        snapshot.loaded = true;
        return snapshot;
        // return fileSnapshots.get(fileName)!;
      }
      // const contentCache = fileContents.get(fileName);
      // if (contentCache) {
      //   const newSnapshot = ts.ScriptSnapshot.fromString(contentCache);
      //   fileSnapshots.set(fileName, newSnapshot);
      //   return newSnapshot;
      // }
      if (!fs.existsSync(fileName)) return;
      const raw = ts.sys.readFile(fileName, "utf8")!;
      const prev = fileSnapshots.get(fileName);
      const snapshot = createIncrementalSnapshot(raw, undefined, prev);
      snapshot.loaded = true;
      fileSnapshots.set(fileName, snapshot);
      return snapshot;
    },
    getScriptVersion: (fileName) => {
      fileName = normalizePath(fileName);
      if (fileName.includes("src/index.ts")) {
        log("getScriptVersion", fileName, fileVersions.get(fileName) ?? 0);
      }
      return (fileVersions.get(fileName) ?? 0).toString();
    },
    logger: log,
  };

  return serviceHost;
}

export function createIncrementalSnapshot(
  content: string,
  [start, end]: [number, number] = [0, content.length],
  prevSnapshot?: IncrementalSnapshot,
): IncrementalSnapshot {
  const s = ts.ScriptSnapshot.fromString(content) as IncrementalSnapshot;
  s.loaded = false;
  return s;

  const snapshot = ts.ScriptSnapshot.fromString(content) as IncrementalSnapshot;
  snapshot.getChangeRange = (oldSnapshot: ts.IScriptSnapshot): ts.TextChangeRange => {
    // if (oldSnapshot) {
    // const range = oldSnapshot.getChangeRange(oldSnapshot);
    // if (range) {
    //   const minStart = Math.min(range.span.start, start);
    //   const maxEnd = Math.max(range.span.start + range.span.length, end);
    //   return {
    //     span: {
    //       start: minStart,
    //       length: maxEnd - minStart,
    //     },
    //     newLength: content.length,
    //   }
    // }
    // }
    if (prevSnapshot?.incremental) {
      const range = prevSnapshot.getChangeRange(prevSnapshot);
      if (range) {
        const minStart = Math.min(range.span.start, start);
        const maxEnd = Math.max(range.span.start + range.span.length, end);
        return {
          span: {
            start: minStart,
            length: maxEnd - minStart,
          },
          newLength: content.length,
        }
      }
    }
    return {
      span: {
        start,
        length: end - start,
      },
      newLength: content.length,
    };
  }
  snapshot.loaded = false;
  snapshot.incremental = true;
  return snapshot;
}

