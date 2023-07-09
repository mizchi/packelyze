function myfn(input) {
  const q = {
    j: 1,
  };
  const z = {
    k: q.j,
    x: input.input,
    p() {
      return this.k + this.x;
    },
  };
  return q.j + z.p();
}
export { myfn }