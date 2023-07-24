const inputs = [
  {
    /*start*/ k: 0,
    /*length*/ x: 10,
  },
];
// TODO: omit type annotations
const internals = inputs.map((d) => {
  return {
    start: d./*start*/ k,
    end: d./*start*/ k + d./*length*/ x,
  };
});
const starts = internals.map((r) => r.start);
const mapped = internals.map((r) => {
  return {
    start: r.start,
    end: r.end,
  };
});

export { mapped, starts };
