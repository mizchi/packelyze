import path from "node:path";
import { test } from "vitest";
// WIP: Now manually generated
import "./globals";
import { assertRollupWithFixture } from "./testUtils";

test("rollup #react-case01-jsx", async () => {
  await assertRollupWithFixture(path.join(__dirname, "../fixtures/react-case01-jsx"));
});
