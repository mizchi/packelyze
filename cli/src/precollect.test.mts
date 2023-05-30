import path from "path";
import { expect, test } from "vitest";
import {
  getCloudflareWorkersReserved,
  getDomReserved,
  getEsReserved,
  getNodeReserved,
  getTerserDompropsReserved,
  getWorkerReserved,
} from "./precollect.mjs";

test("check reserved", async () => {
  const typescriptPath = require.resolve("typescript");
  const terserMainPath = require.resolve("terser");
  const cfWorkersPath = path.join(
    __dirname,
    "../node_modules/@cloudflare/workers-types/index.d.ts",
  );
  const nodeGlobalDtsPath = path.join(
    __dirname,
    "../node_modules/@types/node/globals.d.ts",
  );

  const tsLibDir = path.dirname(typescriptPath);

  const dompropsReserved = await getTerserDompropsReserved(terserMainPath);
  const domReserved = await getDomReserved(tsLibDir);
  const workerReserved = await getWorkerReserved(tsLibDir);
  const esReserved = await getEsReserved(tsLibDir);
  const nodeReserved = await getNodeReserved(nodeGlobalDtsPath);

  const cfWorkersReserved = await getCloudflareWorkersReserved(cfWorkersPath);

  console.log("nodeReserved", nodeReserved.size);

  const full = new Set([...esReserved, ...domReserved, ...workerReserved]);
  const fullWithDomprops = new Set([
    ...esReserved,
    ...domReserved,
    ...workerReserved,
    ...dompropsReserved,
  ]);

  expect(esReserved.size).toBeGreaterThan(500);
  expect(esReserved.size).toBeLessThan(1000);

  expect(domReserved.size).toBeGreaterThan(4000);
  expect(workerReserved.size).toBeGreaterThan(1000);

  expect(full.size).toBeGreaterThan(4000);
  expect(full.size).toBeLessThan(6000);

  expect(fullWithDomprops.size).toBeGreaterThan(8000);
  expect(fullWithDomprops.size).toBeLessThan(9000);

  expect(cfWorkersReserved.size).toBeGreaterThan(500);
  expect(cfWorkersReserved.size).toBeLessThan(1000);

  expect(nodeReserved.size).toBeGreaterThan(50);
  expect(nodeReserved.size).toBeLessThan(100);
});
