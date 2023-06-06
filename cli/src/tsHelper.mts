import ts from "typescript";

export async function createLoadedProjectWatcher(tsconfigPath: string) {
  const host = ts.createWatchCompilerHost(
    tsconfigPath!,
    undefined,
    ts.sys,
    ts.createEmitAndSemanticDiagnosticsBuilderProgram,
    // ignore flush
    (diagnostic) => {},
    // ignore flush
    (diagnostic) => {},
  );
  const originalPostProgramCreate = host.afterProgramCreate;

  host.afterProgramCreate = (program) => {
    originalPostProgramCreate!(program);
  };
  return ts.createWatchProgram(host);
}

export function getTsconfigPath() {
  const configOptoolsPath = ts.findConfigFile(
    "./",
    ts.sys.fileExists,
    "tsconfig.json",
  );
  if (configOptoolsPath) {
    return configOptoolsPath;
  }

  const configPath = ts.findConfigFile(
    "./",
    ts.sys.fileExists,
    "tsconfig.json",
  );
  if (configPath) {
    return configPath;
  }
}
