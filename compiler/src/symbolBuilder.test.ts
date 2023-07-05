import { expect, test } from "vitest";
import { createSymbolBuilder } from "./symbolBuilder";

test("createSymbolBuilder", () => {
  const bannedNames = ["x", "kk"];
  const symbolBuilder = createSymbolBuilder();
  const banFilter = (name: string) => {
    return !bannedNames.includes(name);
  };
  expect(symbolBuilder.create(banFilter)).toBe("k");
  expect(symbolBuilder.create(banFilter)).toBe("j");
  expect(symbolBuilder.create(banFilter)).toBe("q");
  expect(symbolBuilder.create(banFilter)).toBe("z");
  // re-pick c with no filter
  expect(symbolBuilder.create()).toBe("x");

  symbolBuilder.reset(53);
  expect(symbolBuilder.create(banFilter)).toBe("E");
  expect(symbolBuilder.create(banFilter)).toBe("kx");
  expect(symbolBuilder.create()).toBe("kk");
});
