import path from "path";
import { expect, test } from "vitest";
import {
  getDomReserved,
  getEsReserved,
  getTerserDompropsReserved,
  getWorkerReserved,
} from "./precollect.mjs";

test("check reserved", async () => {
  const resolved = require.resolve("typescript");
  const terserMainPath = require.resolve("terser");

  const tsLibDir = path.dirname(resolved);

  const dompropsReserved = await getTerserDompropsReserved(terserMainPath);
  const domReserved = await getDomReserved(tsLibDir);
  const workerReserved = await getWorkerReserved(tsLibDir);
  const esReserved = await getEsReserved(tsLibDir);
  const full = new Set([...esReserved, ...domReserved, ...workerReserved]);
  const fullWithDomprops = new Set([
    ...esReserved,
    ...domReserved,
    ...workerReserved,
    ...dompropsReserved,
  ]);

  // expect(fullWithDomprops.size).toBeGreaterThan(1000);
  expect(esReserved.size).toBeGreaterThan(500);
  expect(esReserved.size).toBeLessThan(1000);

  expect(domReserved.size).toBeGreaterThan(4000);
  expect(workerReserved.size).toBeGreaterThan(1000);

  expect(full.size).toBeGreaterThan(4000);
  expect(full.size).toBeLessThan(6000);

  expect(fullWithDomprops.size).toBeGreaterThan(8000);
  expect(fullWithDomprops.size).toBeLessThan(9000);

  // console.log("domprops", dompropsReserved.size);
  // console.log("esReserved.size", esReserved.size);
  // console.log("domReserved.size", domReserved.size);
  // console.log("workerReserved.size", workerReserved.size);
  // console.log("full", full.size);
  // console.log("fullWithDomprops", fullWithDomprops.size);
});
