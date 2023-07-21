import ts from "typescript";
import { SymbolWalkerResult } from "./ts/types";
import { BatchRenameLocationWithSource, CodeAction, FileChangeResult } from "./transform/transformTypes";

// subset of rollup plugin but not only for rollup
export interface Minifier {
  process(): void;
  createProcess(): MinifierProcessGenerator;
  readFile(fileName: string): string | undefined;
  notifyChange(fileName: string, content: string): void;
  getSourceMapForFile(id: string): string | undefined;
  exists(fileName: string): boolean;
  getCompilerOptions(): ts.CompilerOptions;
}

export type TsMinifyOptions = {
  // current dir
  cwd?: string;
  // searching extension for rollup resolveId
  extensions?: string[];
  // explicit rootFileNames (required by vite)
  rootFileNames?: string[];
  // override compiler options
  compilerOptions?: Partial<ts.CompilerOptions>;
  // override transpile compiler options
  transpileOptions?: Partial<ts.CompilerOptions>;
  // transform only include
  include?: string[];
  // load transformed code only to use with other plugins (e.g. rollup-plugin-ts)
  preTransformOnly?: boolean;
};

export const enum MinifierProcessStep {
  PreDiagnostic,
  Analyze,
  CreateActionsForFile,
  AllActionsCreated,
  ExpandRenameLocations,
  ApplyFileChanges,
  PostDiagnostic,
}

type PreDiagnosticStep = {
  stepName: MinifierProcessStep.PreDiagnostic;
  diagnostics: ReadonlyArray<ts.Diagnostic>;
};

type AnalyzeStep = {
  stepName: MinifierProcessStep.Analyze;
  visited: SymbolWalkerResult;
};

type CreateActionsForFileStep = {
  stepName: MinifierProcessStep.CreateActionsForFile;
  actions: CodeAction[];
  fileName: string;
};

type AllActionsCreatedStep = {
  stepName: MinifierProcessStep.AllActionsCreated;
  actions: CodeAction[];
};

type ExpandRenamesStep = {
  stepName: MinifierProcessStep.ExpandRenameLocations;
  renames: BatchRenameLocationWithSource[];
};

type ApplyFileChangesStep = {
  stepName: MinifierProcessStep.ApplyFileChanges;
  changes: FileChangeResult[];
};

type PostDiagnosticStep = {
  stepName: MinifierProcessStep.PostDiagnostic;
  diagnostics: ReadonlyArray<ts.Diagnostic>;
};

export type MinifierProcessGenerator = Generator<
  | PreDiagnosticStep
  | AnalyzeStep
  | CreateActionsForFileStep
  | AllActionsCreatedStep
  | ExpandRenamesStep
  | ApplyFileChangesStep
  | PostDiagnosticStep
>;
