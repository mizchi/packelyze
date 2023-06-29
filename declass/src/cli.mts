#!/usr/bin/env node
import { parseArgs } from "node:util";
import ts from "typescript";
import path from "node:path";
import fs from "node:fs";
import process from "node:process";
import { declassTransformerFactory } from "./transformer.mjs";

const args = parseArgs({
  args: process.argv.slice(2),
  options: {
    out: {
      type: "string",
      short: "o",
    },
  },
  allowPositionals: true,
});

const filepath = args.positionals[0];
const absFilepath = path.resolve(process.cwd(), filepath);

const code = fs.readFileSync(absFilepath, "utf-8");
const sourceFile = ts.createSourceFile(absFilepath, code, ts.ScriptTarget.ESNext, true);
const result = ts.transform(sourceFile, [declassTransformerFactory]);
const transformedSourceFile = result.transformed[0];

const printer = ts.createPrinter();

const transformedCode = printer.printFile(transformedSourceFile);

if (args.values.out) {
  const outPath = path.resolve(process.cwd(), args.values.out);
  fs.writeFileSync(outPath, transformedCode);
} else {
  console.log(transformedCode);
}
