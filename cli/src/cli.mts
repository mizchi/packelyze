import path from "node:path";
import fs from "node:fs";
import process from "node:process";
import { parseArgs } from "node:util";

import ts from "typescript";

import { collectProperties } from "./analyzer.mjs";
import { bundleDts } from "./generator.mjs";
import { validateOptoolsConfig } from "./options.mjs";

export async function analyzeDts() {
  const cwd = process.cwd();
  const args = parseArgs({
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
      // TODO: validate config
      if (validateOptoolsConfig(config) || true) {
        argsValues = {
          ...argsValues,
          ...config,
          // override: prefer input and output
          input: args.values.input || config.input,
          output: args.values.output || config.output,
        };
      } else {
        console.error("[optools] invalid config - optools.config.json");
        process.exit(1);
      }
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

  if (debug) console.log(args);

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
  if (argsValues.builtins) {
    // @ts-ignore
    const builtins = await import("../gen/builtins.mjs");
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

export async function init() {
  const cwd = process.cwd();
  const args = parseArgs({
    options: {
      config: {
        type: "string",
        short: "c",
        default: "optools.config.json",
      },
    },
  });

  if (args.values.config != null) {
    const configPath = path.join(cwd, args.values.config);
    if (fs.existsSync(configPath)) {
      console.error("[optools] config file already exists", configPath);
      process.exit(1);
    }
    fs.writeFileSync(
      configPath,
      JSON.stringify(
        {
          input: "lib/index.d.ts",
          output: "_optools-analyzed.json",
          builtins: ["dom", "browser", "worker", "httpHeaders"],
          external: [],
        },
        null,
        2,
      ),
    );
    console.error("[optools] generate config >", configPath);
    // TODO: use inquiry
    // generate tsconfig.optools.json
    const tsConfigOptoolsPath = path.join(cwd, "tsconfig.optools.json");
    fs.writeFileSync(
      tsConfigOptoolsPath,
      JSON.stringify(
        {
          extends: "./tsconfig.json",
          compilerOptions: {
            rootDir: "src",
            outDir: "lib",
            declaration: true,
            emitDeclarationOnly: true,
          },
        },
        null,
        2,
      ),
    );
    console.error(
      "[optools:init] generate tsconfig.optools.json >",
      tsConfigOptoolsPath,
    );

    // check tsconfig.json exists
    const tsconfigPath = path.join(cwd, "tsconfig.json");
    if (!fs.existsSync(tsconfigPath)) {
      console.info("[optools:init] warning! tsconfig.json does not exist");
    }

    // print usage example
    console.log(`[optools:init] Ready for optimization!

1. Add "prebuild" scripts to package.json

"scripts": {
  "analyze": "tsc -p tsconfig.optools.json && optools analyze-dts",
  "build": "npm run analyze && <your build command>"
}

2. Ignore _optools-analyzed.json in .gitignore

3. Use with terser

import analyzed from "./_optools-analyzed.json";
// ... in terser config
{
  mangle: {
    properties: {
      builtins: true,
      regex: /.*/,
      reserved: analyzed.reserved
    }
  }
}

`);
  }
}

async function doctor() {
  const cwd = process.cwd();
  // check gitignore
  const gitignorePath = path.join(cwd, ".gitignore");
  if (fs.existsSync(gitignorePath)) {
    const gitignore = fs.readFileSync(gitignorePath, "utf-8");
    if (!gitignore.includes("_optools-analyzed.json")) {
      console.error(
        "[optools:doctor] .gitignore does not include _optools-analyzed.json",
      );
      process.exit(1);
    }
  }
  // check src/index.ts or exists
  const srcIndexTsPath = path.join(cwd, "src/index.ts");
  const srcIndexTsxPath = path.join(cwd, "src/index.tsx");

  if (!fs.existsSync(srcIndexTsPath) && !fs.existsSync(srcIndexTsxPath)) {
    console.error("[optools:doctor] src/index.ts(x) does not exist");
  }

  // check tsconfig.json
  // exists tsconfig.json or tsconfig.optools.json or optools.types.json
  const tsconfigPath = path.join(cwd, "tsconfig.json");
  const tsconfigOptoolsPath = path.join(cwd, "tsconfig.optools.json");
  let existsAny = false;
  for (
    const configPath of [
      tsconfigOptoolsPath,
      tsconfigPath,
    ]
  ) {
    if (fs.existsSync(configPath)) {
      // TODO: check with typescript config extends
      existsAny = true;
      const tsconfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));
      const basename = path.basename(configPath);
      // check rootDir: src
      if (tsconfig.compilerOptions?.outDir !== "lib") {
        console.error(
          `[optools:doctor] ${basename} does not include "rootDir": "lib"`,
        );
      }

      // check declaration: true
      if (tsconfig.compilerOptions?.declaration !== true) {
        console.error(
          `[optools:doctor] ${basename} does not include "declaration": true`,
        );
      }
      break;
    }
  }
  if (!existsAny) {
    console.error(
      "[optools:doctor] tsconfig.optools.json / tsconfig.json does not exist",
    );
    process.exit(1);
  }
  process.exit(0);
}

async function run(cmd: string) {
  switch (cmd) {
    case "init": {
      await init();
      break;
    }
    case "doctor": {
      await doctor();
      break;
    }
    case "analyze-dts": {
      await analyzeDts();
      break;
    }
    default: {
      console.error("[optools] Unknown command", cmd);
    }
  }
}

const cmd = process.argv[2];
run(cmd).catch((e) => {
  console.error(e);
  process.exit(1);
});
