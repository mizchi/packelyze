type Input = {
  start: number;
  length: number;
};

type Internal = {
  start: number;
  end: number;
};

const inputs: Input[] = [
  {
    start: 0,
    length: 10,
  },
];

// TODO: omit type annotations
const internals: Internal[] = inputs.map<Internal>((d) => {
  return {
    start: d.start,
    end: d.start + d.length,
  };
});

export const starts = internals.map((r) => r.start);
