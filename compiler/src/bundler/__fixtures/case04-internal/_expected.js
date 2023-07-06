function myfn(input) {
  const z = {
    q: 1,
  };
  ({
    k: z.q,
    x: input.input,
    f() {
      return this.k + this.x;
    },
  });
  return z.q + f();
}
export { myfn };