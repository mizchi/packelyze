type X = {
  type: "X";
  payload: {
    x: string;
  };
};

function identify<T>(v: T): T {
  return v;
}

export const v = identify<X>({ type: "X", payload: { x: "D" } });
