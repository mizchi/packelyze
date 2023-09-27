import path from "path";
import fs from "fs/promises";
import { httpHeaders } from "../gen/httpHeaders.mjs";
import {
  getCloudflareWorkersReserved,
  getCssReserved,
  getDomReserved,
  getEsReserved,
  getNodeReserved,
  getReactReserved,
  getTerserDompropsReserved,
  getWorkerReserved,
} from "../lib/precollect.mjs";

function getHttpHeadersReserved() {
  return new Set([
    ...httpHeaders,
    ...httpHeaders.map((header) => header.toLowerCase()),
    ...httpHeaders.map((header) => header.toUpperCase()),
  ]);
}

const __dirname = path.dirname(new URL(import.meta.url).pathname);
export async function dumpReservedWords() {
  const tsPath = path.join(__dirname, "../node_modules/typescript/lib/typescript.js");
  const terserMainPath = path.join(__dirname, "../node_modules/terser/dist/bundle.min.js");
  const cfWorkersTypesPath = path.join(__dirname, "../node_modules/@cloudflare/workers-types/index.d.ts");
  const cssDtsPath = path.join(__dirname, "../node_modules/csstype/index.d.ts");

  const nodeDtsDir = path.join(__dirname, "../node_modules/@types/node");
  const reactDtsDir = path.join(__dirname, "../node_modules/@types/react");

  const tsLibDir = path.dirname(tsPath);
  const cssReserved = await getCssReserved(cssDtsPath);
  const dompropsReserved = await getTerserDompropsReserved(terserMainPath);
  const domReserved = await getDomReserved(tsLibDir, cssReserved);
  const workerReserved = await getWorkerReserved(tsLibDir);
  const esReserved = await getEsReserved(tsLibDir);
  const httpHeadersReserved = getHttpHeadersReserved();
  const cloudflareWorkersReserved = await getCloudflareWorkersReserved(cfWorkersTypesPath);
  const nodeReserved = await getNodeReserved(nodeDtsDir);
  const reactReserved = await getReactReserved(reactDtsDir, cssReserved);

  console.log("domprops", dompropsReserved.size);
  console.log("css", cssReserved.size);
  console.log("es", esReserved.size);
  console.log("dom", domReserved.size);
  console.log("worker", workerReserved.size);
  console.log("httpHeaders", httpHeadersReserved.size);
  console.log("cloudflareWorkers", cloudflareWorkersReserved.size);
  console.log("node", nodeReserved.size);
  console.log("react", reactReserved.size);

  const output = `// generated by scripts/gen-builtins.mjs
export const es = ${JSON.stringify([...esReserved].sort(), null, 2)};
export const dom = ${JSON.stringify([...domReserved].sort(), null, 2)};
export const css = ${JSON.stringify([...cssReserved].sort(), null, 2)};
export const worker = ${JSON.stringify([...workerReserved].sort(), null, 2)};
export const httpHeaders = ${JSON.stringify([...httpHeadersReserved].sort(), null, 2)};
export const react = ${JSON.stringify([...reactReserved].sort(), null, 2)};
export const node = ${JSON.stringify([...nodeReserved].sort(), null, 2)};
export const cloudflareWorkers = ${JSON.stringify([...cloudflareWorkersReserved].sort(), null, 2)};
export const domprops = ${JSON.stringify([...dompropsReserved].sort(), null, 2)};
`;
  await fs.writeFile(path.join(__dirname, "../gen/builtins.mjs"), output);
}

await dumpReservedWords();