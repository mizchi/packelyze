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
function componentLike1(props: { prop1: number; prop2: number }) {
  return props.prop1 + props.prop2;
}
export function componentLike2() {
  return componentLike1({ prop1: 1, prop2: 2 });
}
