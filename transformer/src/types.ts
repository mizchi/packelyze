import ts from "typescript";
import {
  BatchRenameLocationWithSource,
  BindingNode,
  CodeAction,
  FileChangeResult,
  ProjectExported,
} from "./transform/transformTypes";

// subset of rollup plugin but not only for rollup
export interface Minifier {
  process(): void;
  readFile(fileName: string): string | undefined;
  notifyChange(fileName: string, content: string): void;
  getSourceMapForFile(id: string): string | undefined;
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
  withOriginalComment?: boolean;
  mangleValidator?: MangleValidator;
  onwarn?: OnWarning;
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

export enum WarningCode {
  MANGLE_STOP_BY_LOCATION_CONFLICT = 1,
  MANGLE_STOP_BY_EXTERNAL,
}

export type Warning = {
  code: WarningCode;
  message: string;
};

export type OnWarning = (warning: Warning) => void;

export type MangleValidator = (biding: BindingNode) => boolean | void;
