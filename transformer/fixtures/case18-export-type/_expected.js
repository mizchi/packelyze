function createObj() {
  return {
    xxx,
    yyy(input) {
      const ret = {
        v1: input./*v1*/ k ?? "hello",
        v2: input./*v2*/ x ?? "world",
      };
      return {
        ...ret,
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
  function xxx() {}
}

const indirect = {
  indirect: 1,
};

export { createObj, indirect };
