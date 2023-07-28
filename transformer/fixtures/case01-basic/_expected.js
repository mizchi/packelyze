import { join } from "node:path";

function ext(a, b) {
  const flocal = "x";
  return join(a, b, flocal);
}

const sub = {
  /*subLocal*/ x: 1,
};

function fff() {
  const fLocal = { /*local*/ k: 1 };
  return {
    pub: fLocal./*local*/ k,
  };
}
const x = fff();
const subItem = sub./*subLocal*/ x;

export { ext, subItem, x };
