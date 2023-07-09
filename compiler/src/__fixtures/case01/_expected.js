import { join } from "node:path";
function ext(a, b) {
  const k = "x";
  return join(a, b, k);
}
const sub = {
  k: 1,
};
function j() {
  const q = { k: 1 };
  return {
    pub: q.k,
  };
}
const x = j();
const subItem = sub.k;
export { ext, subItem, x };