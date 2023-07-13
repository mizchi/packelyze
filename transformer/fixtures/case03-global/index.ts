export const foo = () => {
  const ret = MyGlobal.f({ x: 1 });
  return MyGlobal.foo + ret.y;
};
