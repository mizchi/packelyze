import path from "path";
import ts from "typescript";
import { collectReservedProperties } from './analyzer.mjs';
import { createManglePropertiesRegexString } from "./helpers.mjs";
import { generateBundleDts, emitLibDts } from "./generator.mjs";

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


async function run() {
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
}

run();