import path from "node:path";
import ts from "typescript";
import fs from "node:fs";
import { parseArgs } from "node:util";
import { collectProperties } from "./analyzer.mjs";
// import { createManglePropertiesRegexString } from "./helpers.mjs";
import { generateBundleDts } from "./generator.mjs";

const args = parseArgs({
  options: {
    input: {
      type: "string",
      default: "index.ts",
      short: "i",
    },
    printDts: {
      type: "boolean",
      default: false,
      short: "p",
    },
    external: {
      type: "string",
      default: [],
      short: "e",
      multiple: true,
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
  const [cmd, ...rest] = args.positionals;
  if (cmd === "analyze-dts") {
    const cwd = process.cwd();
    if (args.values.input == null) {
      console.error("input (-i) is required");
      process.exit(1);
    }
    const input = path.join(cwd, args.values.input!);
    // const respectExternal = args.values.includeExternal!;
    const respectExternal = true;
    const debug = args.values.debug;
    const printDts = args.values.printDts;

    if (debug) console.log(args);

    const dtsCode = await generateBundleDts({
      input,
      external: args.values.external || [],
      // respectExternal: !!args.values.external?.length,
      respectExternal: true,
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
    const result = collectProperties(source, debug);

    if (args.values.mode === "list") {
      console.log(result.reserved);
    } else if (args.values.mode === "json") {
      console.log(JSON.stringify(
        result,
        null,
        2,
      ));
    }
    if (args.values.output) {
      const outpath = path.join(cwd, args.values.output);
      console.log("[optools:generate]", outpath.replace(cwd + "/", ""));
      fs.writeFileSync(outpath, JSON.stringify(result, null, 2));
    } else {
      console.log(JSON.stringify(result, null, 2));
    }
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
