export function createManglePropertiesRegexString(props: Iterable<string>) {
  const props_regex = Array.from(props).join("|");
  return `^(?!(${props_regex})$).*`;
}

if (import.meta.vitest) {
  const { test, expect } = import.meta.vitest;
  test("createManglePropertiesRegexString", () => {
    const keys = new Set(["a", "b", "c"]);
    const regex = createManglePropertiesRegexString(keys);
    expect(new RegExp(regex).test("a")).toBe(false);
    expect(new RegExp(regex).test("aaa")).toBe(true);
  });
}
