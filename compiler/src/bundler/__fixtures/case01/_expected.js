import { join } from "node:path";
function ext(a, b) {
  const k = "x";
  return join(a, b, k);
}
const sub = {
  x: 1,
};
function q() {
  const z = { j: 1 };
  return {
    pub: z.j,
  };
}
const x = q();
const subItem = sub.x;

export { ext, subItem, x };