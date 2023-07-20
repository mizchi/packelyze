function createObj() {
  return {
    xxx: x,
    yyy(input) {
      const k = {
        v1: input.k ?? "hello",
        v2: input.x ?? "world",
      };
      return {
        ...k,
      };
    },
  };
  function x() {}
}

export { createObj };
