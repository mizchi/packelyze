const foo = () => {
  const k = MyGlobal.f({ x: 1 });
  return MyGlobal.foo + k.y;
};
export { foo };