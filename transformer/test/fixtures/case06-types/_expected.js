function foo(arg) {
  switch (arg.type) {
    case "A": {
      return arg.payload.a;
    }
    case "B": {
      return arg.payload.b;
    }
  }
}
function createPayloadOfC() {
  return {
    c: "c",
  };
}
export { createPayloadOfC, foo };