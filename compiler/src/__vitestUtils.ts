import { expect } from "vitest";

expect.extend({
  toEqualSet(received, expected) {
    const { isNot } = this;
    const receivedSet = new Set(received);
    const expectedSet = new Set(expected);
    const pass = received.size === expected.size && [...receivedSet].every((item) => expectedSet.has(item));

    return {
      // do not alter your "pass" based on isNot. Vitest does it for you
      pass,
      message: () => {
        // if (isNot) {
        const plus = [...expectedSet].filter((item) => !receivedSet.has(item)).map((x) => `"${x}"`);
        const minus = [...receivedSet].filter((item) => !expectedSet.has(item)).map((x) => `"${x}"`);
        let text = `Set Diff:`;
        if (plus.length > 0) {
          text += ` + ${plus.join(", ")}`;
        }
        if (minus.length > 0) {
          text += ` - ${minus.join(", ")}`;
        }
        return text;
        // }
        // return `${[...received].map((t) => t)} is ${[...expected].map((t) => t)}`;
      },
    };
  },
});
