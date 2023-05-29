import { collectProperties } from "./analyzer.mjs";
import fs from "fs/promises";
import path from "path";
import ts from "typescript";

const domReservedFiles = [
  "lib.dom.d.ts",
  "lib.dom.iterable.d.ts",
];

const workerReservedFiles = [
  "lib.webworker.d.ts",
  "lib.webworker.importscripts.d.ts",
];

export async function getEsReserved(tsLibDir: string) {
  const filepaths = await fs.readdir(tsLibDir);
  const dtsPaths = filepaths
    .filter((t) => t.startsWith("lib.") && t.endsWith(".d.ts"))
    .filter((t) =>
      !domReservedFiles.includes(t) && !workerReservedFiles.includes(t)
    )
    .map((filepath) => path.join(tsLibDir, filepath));

  // console.log("dtsPaths", dtsPaths.map((d) => d.replace(tsLibDir, "")));
  const reserved = await getReservedFromFileList(dtsPaths);
  return reserved;
}

export async function getDomReserved(tsLibDir: string) {
  const filepaths = await fs.readdir(tsLibDir);
  const dtsPaths = filepaths
    .filter((t) => t.startsWith("lib.") && t.endsWith(".d.ts"))
    .filter((t) => domReservedFiles.includes(t))
    .map((filepath) => path.join(tsLibDir, filepath));

  const reserved = await getReservedFromFileList(dtsPaths);
  return reserved;
}

export async function getWorkerReserved(tsLibDir: string) {
  const filepaths = await fs.readdir(tsLibDir);
  const dtsPaths = filepaths
    .filter((t) => t.startsWith("lib.") && t.endsWith(".d.ts"))
    .filter((t) => workerReservedFiles.includes(t))
    .map((filepath) => path.join(tsLibDir, filepath));

  const reserved = await getReservedFromFileList(dtsPaths);
  return reserved;
}

export async function getTerserDompropsReserved(terserMainPath: string) {
  const dompropsPath = terserMainPath.replace(
    "/dist/bundle.min.js",
    "/tools/domprops.js",
  );
  const mod = await import(dompropsPath);
  return new Set<string>(mod.domprops);
}

async function getReservedFromFileList(filelist: string[]) {
  const reserved = new Set<string>();
  for (const file of filelist) {
    const code = await fs.readFile(file, "utf-8");
    const source = ts.createSourceFile(
      "a.d.ts",
      code,
      ts.ScriptTarget.ES2019,
      true,
    );
    const result = collectProperties(source);
    for (const prop of result.reserved) {
      reserved.add(prop);
    }
  }
  return reserved;
}