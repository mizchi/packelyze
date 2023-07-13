function myfn(input) {
  const q = {
    j: 1,
  };
  const z = {
    k: q.j,
    x: input.input,
    get() {
      return this.k + this.x;
    },
  };
  return q.j + z.get();
}
function p(props) {
  return props.f + props.y;
}
function componentLike2() {
  return p({ f: 1, y: 2 });
}

export { componentLike2, myfn };