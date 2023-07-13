const j = [
  {
    k: 0,
    x: 10,
  },
];
// TODO: omit type annotations
const q = j.map((d) => {
  return {
    start: d.k,
    end: d.k + d.x,
  };
});
const starts = q.map((r) => r.start);

export { starts };
