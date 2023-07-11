type A = {
  type: "A";
  payload: {
    a: string;
  };
};

type B = {
  type: "B";
  payload: {
    b: string;
  };
};

export function foo(arg: A | B) {
  switch (arg.type) {
    case "A": {
      return arg.payload.a;
    }
    case "B": {
      return arg.payload.b;
    }
  }
}

type C = {
  type: "C";
  payload: {
    c: string;
  };
};

export function createPayloadOfC(): C["payload"] {
  return {
    c: "c",
  };
}
