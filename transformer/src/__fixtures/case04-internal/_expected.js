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
function f(props) {
  return props.y + props.w;
}
function componentLike2() {
  return f({ y: 1, w: 2 });
}
export { componentLike2, myfn }