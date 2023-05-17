import path from "path";
import ts from "typescript";
import { type OutputChunk, rollup } from "rollup";
import dts from "rollup-plugin-dts";

const defaultCompilerOptions: ts.CompilerOptions = {
  target: ts.ScriptTarget.Latest,
  jsx: ts.JsxEmit.ReactJSX,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  esModuleInterop: true,
  forceConsistentCasingInFileNames: true,
  resolveJsonModule: true,
  strict: true,
  skipLibCheck: true,
};

function emitLibDts(
  files: string[],
  outDir: string,
  options: ts.CompilerOptions = defaultCompilerOptions,
) {
  const shouldOverrideConfigs: Partial<ts.CompilerOptions> = {
    outDir,
    declaration: true,
    emitDeclarationOnly: true,
    noEmit: true,
  };
  const host = ts.createCompilerHost({
    ...options,
    ...shouldOverrideConfigs,
  });
  const program = ts.createProgram(files, options, host);
  const emitResult = program.emit();
  return emitResult;
}

async function generateBundleDts(
  { input, compilerOptions, respectExternal = false }: {
    input: string;
    respectExternal?: boolean;
    compilerOptions?: ts.CompilerOptions;
  },
) {
  const bundle = await rollup({
    input: input,
    plugins: [dts({
      respectExternal,
      compilerOptions,
    })],
  });
  const out = await bundle.generate({
    format: "es",
  });
  const dtsCode = out.output.find((o) => {
    if (o.type === "chunk" && o.fileName.endsWith(".d.ts")) {
      return true;
    }
  }) as OutputChunk;
  return dtsCode.code;
}

// ----- Logics -------
function isHiddenMemberOfClass(
  node: ts.MethodDeclaration | ts.PropertyDeclaration,
) {
  const hasPrivateKeyword = node.modifiers?.some((m) => {
    return m.kind === ts.SyntaxKind.PrivateKeyword;
  });
  return hasPrivateKeyword || ts.isPrivateIdentifier(node.name!);
}

const collectReservedProperties = (root: ts.Node, debug: boolean = false) => {
  const debugLog = (...args: any) => {
    if (debug) {
      console.log(...args);
    }
  };
  const reserved_props: Set<string> = new Set();
  const _traverse = (node: ts.Node, depth: number = 0) => {
    const prefix = " ".repeat(depth * 2);
    const prefix1 = " ".repeat((depth + 1) * 2);
    // module X { class x = 1; }
    const underModule = node.parent &&
      ts.isModuleBlock(node.parent);
    debugLog(prefix, "[", ts.SyntaxKind[node.kind], "]", !!underModule);

    // console.log(prefix, "isParentModule", isParentModule);
    // TODO: internal module

    if (ts.isModuleDeclaration(node)) {
      if (node.name) {
        debugLog(prefix1, "-module:", node.name.getText());
        reserved_props.add(node.name?.getText() ?? "");
      }
    }

    if (ts.isVariableStatement(node) && underModule) {
      for (const decl of node.declarationList.declarations) {
        if (ts.isIdentifier(decl.name)) {
          debugLog(prefix1, "-module-variable:", decl.name.getText());
          reserved_props.add(decl.name?.getText() ?? "");
        }
      }
      // console.log(node);
      // throw "stop";
      // if (nod ts.isIdentifier(node.initializer) {

      // }
      // if (node.name) {
      //   debugLog(prefix1, "module-variable:", node.name.getText());
      //   // reserved_props.add(node.name?.getText() ?? "");
      // }
    }

    if (ts.isTypeLiteralNode(node)) {
      node.members.forEach((member) => {
        if (ts.isPropertySignature(member)) {
          debugLog(prefix1, "-property:", member.name?.getText());
          reserved_props.add(member.name?.getText() ?? "");
        }
        // member.name
      });
    }
    if (ts.isInterfaceDeclaration(node)) {
      node.members.forEach((member) => {
        if (ts.isMethodSignature(member)) {
          debugLog(prefix1, "-method:", member.name?.getText());
          reserved_props.add(member.name?.getText() ?? "");
        }
        if (ts.isPropertySignature(member)) {
          debugLog(prefix1, "-property:", member.name?.getText());
          reserved_props.add(member.name?.getText() ?? "");
        }
      });
      if (underModule) {
        if (node.name) {
          debugLog(prefix1, "-interface:", node.name.getText());
          reserved_props.add(node.name?.getText() ?? "");
        }
      }
    }
    if (ts.isTypeAliasDeclaration(node)) {
      if (underModule) {
        if (node.name) {
          debugLog(prefix1, "-typeAlias:", node.name.getText());
          reserved_props.add(node.name?.getText() ?? "");
        }
      }
    }

    if (ts.isClassDeclaration(node)) {
      node.members.forEach((member) => {
        if (ts.isMethodDeclaration(member)) {
          if (!isHiddenMemberOfClass(member)) {
            debugLog(prefix1, "-method:", member.name?.getText());
            reserved_props.add(member.name?.getText() ?? "");
          }
        }
        if (ts.isPropertyDeclaration(member)) {
          const hidden = isHiddenMemberOfClass(member);
          debugLog(
            prefix,
            "-property:",
            member.name?.getText(),
            hidden,
          );
          if (!hidden) {
            reserved_props.add(member.name?.getText() ?? "");
          }
        }
        // member.name
      });

      if (underModule) {
        if (node.name) {
          debugLog(prefix1, "-class:", node.name.getText());
          reserved_props.add(node.name?.getText() ?? "");
        }
      }
    }

    // terser will mangle exported names
    // if (ts.isExportDeclaration(node)) {
    //   if (ts.isNamedExports(node.exportClause!)) {
    //     for (const element of node.exportClause.elements) {
    //       debugLog("exports", element.name?.getText());
    //       reserved_keys.add(element.name?.getText());
    //     }
    //   }
    // }

    ts.forEachChild(node, (node) => {
      _traverse(node, depth + 1);
    });
  };
  _traverse(root);
  return reserved_props;
};

function createManglePropertiesRegexString(props: Set<string>) {
  const props_regex = Array.from(props).join("|");
  return `^(?!(${props_regex})).*`;
}
// --------------------

// CLI

import { parseArgs } from "node:util";
import fs from "fs";

const args = parseArgs({
  options: {
    tsconfigPath: {
      type: "string",
      default: "tsconfig.json",
      short: "p",
    },
    input: {
      type: "string",
      default: "index.ts",
      short: "i",
    },
    skipLibDts: {
      type: "boolean",
      default: false,
    },
    printDts: {
      type: "boolean",
      default: false,
      short: "p",
    },
    stopOnError: {
      type: "boolean",
      default: false,
    },
    respectExternal: {
      type: "boolean",
      default: true,
    },
    debug: {
      type: "boolean",
      default: false,
      short: "d",
    },
    mode: {
      type: "string",
      short: "m",
    },
    output: {
      type: "string",
      short: "o",
    },
  },
  allowPositionals: true,
});

const cwd = process.cwd();
const defaultTsConfigPath = path.join(cwd, args.values.tsconfigPath!);
const outputLibDir = path.join(process.cwd(), "lib-dts");

if (args.values.input == null) {
  console.error("input (-i) is required");
  process.exit(1);
}

const input = path.join(cwd, args.values.input!);
const inputBase = path.basename(input);
const inputDts = path.join(outputLibDir, inputBase.replace(/\.ts$/, ".d.ts"));

const files = args.positionals.map((file) => path.join(cwd, file));
const skipLibDts = args.values.skipLibDts;
const respectExternal = args.values.respectExternal!;
// const printDts = args.values.printDts;
const debug = args.values.debug;
const printDts = args.values.printDts;

if (debug) console.log(args);

const tsconfig = ts.parseConfigFileTextToJson(
  defaultTsConfigPath,
  fs.readFileSync(defaultTsConfigPath, "utf-8"),
);

const config = ts.convertCompilerOptionsFromJson(
  tsconfig.config.compilerOptions,
  ".",
);

if (!skipLibDts) {
  const result = emitLibDts(files, outputLibDir, config.options);
  if (debug) {
    console.log("EmitResult", result);
  }
}

const dtsCode = await generateBundleDts({
  input: inputDts,
  respectExternal,
});

if (printDts) {
  console.log("// bundled.d.ts");
  console.log(dtsCode);
  process.exit(0);
}

const source = ts.createSourceFile(
  "bundle.d.ts",
  dtsCode,
  ts.ScriptTarget.Latest,
  true,
);
const publicProperties = collectReservedProperties(source, debug);
const analyzeResult = {
  reservedProperties: [...publicProperties],
  manglePropertiesRegex: createManglePropertiesRegexString(publicProperties),
};

if (args.values.mode === "regex") {
  console.log(createManglePropertiesRegexString(publicProperties));
} else if (args.values.mode === "json") {
  console.log(JSON.stringify(
    analyzeResult,
    null,
    2,
  ));
}

if (args.values.output) {
  const outpath = path.join(cwd, args.values.output);
  console.log("[gen:result]", outpath.replace(cwd + "/", ""));
  fs.writeFileSync(outpath, JSON.stringify(analyzeResult, null, 2));
} else {
  console.log(JSON.stringify(analyzeResult, null, 2));
}
