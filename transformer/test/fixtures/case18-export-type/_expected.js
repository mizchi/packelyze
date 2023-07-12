function createObj() {
  return {
    xxx: k,
    yyy() {
      return undefined;
    },
  };
  function k() {}
}
export { createObj };