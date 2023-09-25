import path from "path";
import { expect, test } from "vitest";
import {
  getCloudflareWorkersReserved,
  getCssReserved,
  getDomReserved,
  getEsReserved,
  getNodeReserved,
  getReactReserved,
  getTerserDompropsReserved,
  getWorkerReserved,
} from "./precollect.mjs";

test("check reserved", async () => {
  const typescriptPath = require.resolve("typescript");
  const terserMainPath = require.resolve("terser");
  const cfWorkersPath = path.join(__dirname, "../node_modules/@cloudflare/workers-types/index.d.ts");
  const cssDtsPath = path.join(__dirname, "../node_modules/csstype/index.d.ts");

  const nodeExternalDtsDir = path.join(__dirname, "../node_modules/@types/node");

  const reactDtsDir = path.join(__dirname, "../node_modules/@types/react");

  const tsLibDir = path.dirname(typescriptPath);
  const cssReserved = await getCssReserved(cssDtsPath);
  const dompropsReserved = await getTerserDompropsReserved(terserMainPath);

  const domReserved = await getDomReserved(tsLibDir, cssReserved);

  const workerReserved = await getWorkerReserved(tsLibDir);
  const esReserved = await getEsReserved(tsLibDir);
  const nodeExternalReserved = await getNodeReserved(nodeExternalDtsDir);
  const reactReserved = await getReactReserved(reactDtsDir, cssReserved);

  const cfWorkersReserved = await getCloudflareWorkersReserved(cfWorkersPath);

  const full = new Set([...esReserved, ...domReserved, ...workerReserved]);
  const fullWithDomprops = new Set([...esReserved, ...domReserved, ...workerReserved, ...dompropsReserved]);

  expect(esReserved.size).toBeGreaterThan(500);
  expect(domReserved.size).toBeGreaterThan(4000);
  expect(workerReserved.size).toBeGreaterThan(1000);
  expect(full.size).toBeGreaterThan(6000);
  expect(fullWithDomprops.size).toBeGreaterThan(8000);
  expect(cfWorkersReserved.size).toBeGreaterThan(500);
  expect(nodeExternalReserved.size).toBeGreaterThan(2500);
  expect(reactReserved.size).toBeGreaterThan(1000);
  expect(cssReserved.size).toBeGreaterThan(1000);
});
