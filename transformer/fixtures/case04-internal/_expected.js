function myfn(input) {
  const hidden = {
    /*hidden*/ j: 1,
  };
  const internal = {
    /*internalPub1*/ k: hidden./*hidden*/ j,
    /*internalPub2*/ x: input.input,
    get() {
      return this./*internalPub1*/ k + this./*internalPub2*/ x;
    },
  };
  return hidden./*hidden*/ j + internal.get();
}
function componentLike1(props) {
  return props./*prop1*/ q + props./*prop2*/ z;
}
function componentLike2() {
  return componentLike1({ /*prop1*/ q: 1, /*prop2*/ z: 2 });
}

export { componentLike2, myfn };
