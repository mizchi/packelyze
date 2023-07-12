function createObj() {
  return {
    xxx: x,
    k() {
      return undefined;
    },
  };
  function x() {}
}
export { createObj as createMinifier };