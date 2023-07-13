function createObj() {
  return {
    xxx: x,
    yyy() {
      const k = {
        value: "hello",
      };
      return k;
    },
  };
  function x() {}
}

export { createObj };
