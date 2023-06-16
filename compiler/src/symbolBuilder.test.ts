import { expect, test } from "vitest";
import {createSymbolBuilder} from "./symbolBuilder";

test("createSymbolBuilder", () => {
  const bannedNames = [
    "c",
    "_a"
  ]
  const symbolBuilder = createSymbolBuilder();
  const banFilter = (name: string) => {
    return !bannedNames.includes(name);
  };
  expect(symbolBuilder.create(banFilter)).toBe("_");
  expect(symbolBuilder.create(banFilter)).toBe("$");
  expect(symbolBuilder.create(banFilter)).toBe("a");
  expect(symbolBuilder.create(banFilter)).toBe("b");
  // skip c in list
  expect(symbolBuilder.create(banFilter)).toBe("d");

  // re-pick c with no filter
  expect(symbolBuilder.create()).toBe("c");

  symbolBuilder.reset(53);
  expect(symbolBuilder.create(banFilter)).toBe("Z");
  expect(symbolBuilder.create(banFilter)).toBe("__");
  expect(symbolBuilder.create(banFilter)).toBe("_$");
  expect(symbolBuilder.create(banFilter)).toBe("_b");
  expect(symbolBuilder.create(banFilter)).toBe("_c");

  // re-pick c with no filter
  expect(symbolBuilder.create()).toBe("_a");
})