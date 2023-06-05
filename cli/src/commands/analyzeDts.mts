import path from "node:path";
import fs from "node:fs";
import process from "node:process";
import { parseArgs } from "node:util";
import ts from "typescript";
import { collectProperties } from "../analyzer.mjs";
import { bundleDts } from "../generator.mjs";

export async function analyzeDts() {
  const cwd = process.cwd();
  const args = parseArgs({
    args: process.argv.slice(3),
    options: {
      config: {
        type: "string",
        short: "c",
        default: "optools.config.json",
      },
      input: {
        type: "string",
        short: "i",
      },
      output: {
        type: "string",
        short: "o",
      },
      external: {
        type: "string",
        default: [],
        short: "e",
        multiple: true,
      },
      builtins: {
        type: "string",
        multiple: true,
        short: "b",
      },
      ambient: {
        type: "string",
        multiple: true,
        short: "a",
      },
      printDts: {
        type: "boolean",
        default: false,
        short: "p",
      },
      debug: {
        type: "boolean",
        default: false,
        short: "d",
      },
    },
    allowPositionals: true,
  });

  // let input: string;
  let argsValues = args.values;
  if (args.values.config) {
    try {
      const configPath = path.join(cwd, args.values.config);
      const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
      argsValues = {
        ...argsValues,
        ...config,
        // override: prefer input and output
        input: args.values.input || config.input,
        output: args.values.output || config.output,
      };
    } catch (e) {
      console.info("[optools] skip loading config - optools.config.json", e);
    }
  }

  if (argsValues.input == null) {
    console.error("input (-i) is required");
    process.exit(1);
  }

  const input = path.join(cwd, argsValues.input!);

  const debug = argsValues.debug;
  const printDts = argsValues.printDts;

  if (debug) {
    console.log(args);
  }

  const dtsCode = await bundleDts({
    input,
    external: argsValues.external || [],
    respectExternal: argsValues.external != null,
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

  const result = collectProperties(source, undefined, debug);

  const buitinsSet = new Set<string>();

  // include builtins
  if (argsValues.builtins) {
    // @ts-ignore
    const builtins = await import("../../gen/builtins.mjs");
    // console.log("[optools:analyze-dts:builtin]", argsValues.builtins);
    for (const builtinName of argsValues.builtins) {
      if (builtinName in builtins) {
        console.log(
          "[optools:analyze-dts:include-builtins]",
          builtinName,
          builtins[builtinName].length,
        );
        for (const builtinProp of builtins[builtinName]) {
          buitinsSet.add(builtinProp);
        }
      }
    }
  }

  // include ambient files
  // TODO: need active search in src/**/*.d.ts ?
  if (Array.isArray(argsValues.ambient)) {
    for (const ambientPath of argsValues.ambient) {
      const filepath = path.join(cwd, ambientPath);
      const ambientCode = fs.readFileSync(filepath, "utf-8");
      const ambientSource = ts.createSourceFile(
        ambientPath,
        ambientCode,
        ts.ScriptTarget.Latest,
        true,
      );
      const ambientResult = collectProperties(
        ambientSource,
        { ambient: true },
        debug,
      );
      for (const builtinProp of ambientResult.reserved) {
        buitinsSet.add(builtinProp);
      }

      console.log(
        "[optools:analyze-dts:include-ambient]",
        ambientPath,
        ambientResult.reserved.length,
      );
    }
  }

  if (argsValues.output) {
    const outpath = path.join(cwd, argsValues.output);
    console.log(
      "[optools:analyze-dts:generate]",
      outpath.replace(cwd + "/", ""),
    );
    fs.writeFileSync(
      outpath,
      JSON.stringify(
        {
          reserved: [...Array.from(buitinsSet), ...result.reserved].sort(),
          privates: result.privates.sort(),
        },
        null,
        2,
      ),
    );
  } else {
    console.log(JSON.stringify(result, null, 2));
  }
}
