function myfn(input) {
  const z = {
    q: 1,
  };
  const p = {
    k: z.q,
    x: input.input,
    j() {
      return this.k + this.x;
    },
  };
  return z.q + p.j();
}
export { myfn };
