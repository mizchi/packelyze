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

export async function getDomReserved(
  tsLibDir: string,
  cssReserved: Set<string>,
) {
  const filepaths = await fs.readdir(tsLibDir);
  const dtsPaths = filepaths
    .filter((t) => t.startsWith("lib.") && t.endsWith(".d.ts"))
    .filter((t) => domReservedFiles.includes(t))
    .map((filepath) => path.join(tsLibDir, filepath));

  const reserved = await getReservedFromFileList(dtsPaths);
  return new Set<string>([...reserved, ...cssReserved]);
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

export async function getCloudflareWorkersReserved(
  cloudflareWorkersTypesDtsPath: string,
) {
  const code = await fs.readFile(cloudflareWorkersTypesDtsPath, "utf-8");
  const source = ts.createSourceFile(
    "a.d.ts",
    code,
    ts.ScriptTarget.ES2019,
    true,
  );
  const result = collectProperties(source);
  return new Set<string>(result.reserved);
}

export async function getNodeReserved(
  nodeDtsDir: string,
) {
  const filesInNode = await fs.readdir(nodeDtsDir, {
    withFileTypes: true,
  });
  const nodeDtsPathList = filesInNode.filter((x) =>
    x.isFile() && x.name.endsWith(".d.ts")
  ).map((x) => path.join(nodeDtsDir, x.name));

  const reserved: string[] = [];
  for (const nodeDtsPath of nodeDtsPathList) {
    const code = await fs.readFile(nodeDtsPath, "utf-8");
    const source = ts.createSourceFile(
      nodeDtsPath,
      code,
      ts.ScriptTarget.ES2019,
      true,
    );
    const result = collectProperties(source);
    reserved.push(...result.reserved);
  }

  return new Set<string>(reserved);
}

export async function getCssReserved(
  cssDtsPath: string,
) {
  const code = await fs.readFile(cssDtsPath, "utf-8");
  const source = ts.createSourceFile(
    "a.d.ts",
    code,
    ts.ScriptTarget.ES2019,
    true,
  );
  const result = collectProperties(source);
  return new Set<string>(result.reserved);
}

export async function getReactReserved(
  reactDtsDir: string,
  cssReserved: Set<string>,
) {
  const filesInReact = await fs.readdir(reactDtsDir, {
    withFileTypes: true,
  });
  const reactDtsPathList = filesInReact.filter((x) =>
    x.isFile() && x.name.endsWith(".d.ts")
  ).map((x) => path.join(reactDtsDir, x.name));

  const reserved: string[] = [];
  for (const reactDtsPath of reactDtsPathList) {
    const code = await fs.readFile(reactDtsPath, "utf-8");
    const source = ts.createSourceFile(
      reactDtsPath,
      code,
      ts.ScriptTarget.ES2019,
      true,
    );
    const result = collectProperties(source);
    reserved.push(...result.reserved);
  }

  return new Set<string>([...reserved, ...cssReserved]);
}

// Analyze https://github.com/denoland/deno/tree/acc6cdc0b1c0fae5e0fba3b0110f96119c2139f7/cli/tsc/dts
export async function getDenoReserved(
  denoDtsDir: string,
) {
  throw new Error("not implemented");
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
