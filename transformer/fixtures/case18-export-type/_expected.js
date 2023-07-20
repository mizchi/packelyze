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
    zzz() {
      return [1, 2, 3].map((i) => {
        return {
          v1: i.toString(),
          v2: i.toString(),
        };
      });
    },
  };
  function x() {}
}

export { createObj };
