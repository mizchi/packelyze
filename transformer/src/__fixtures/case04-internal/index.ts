export function myfn(input: {
  input: number;
}) {
  type Internal1 = { internalPub1: number; internalPub2: number; get(): number };
  type Internal2 = { hidden: number };
  const hidden: Internal2 = {
    hidden: 1,
  };
  const internal: Internal1 = {
    internalPub1: hidden.hidden,
    internalPub2: input.input,
    get() {
      return this.internalPub1 + this.internalPub2;
    },
  };
  return hidden.hidden + internal.get();
}
