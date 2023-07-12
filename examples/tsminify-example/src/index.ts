import { ext } from "./ext";
import { sub } from "./sub";

type Local1 = {
  l1: number;
};
type Local2 = {
  l2: number;
};

function fff(): Local2 {
  const fLocal: Local1 = { l1: 1 };
  return {
    l2: fLocal.l1,
  };
}
const x = fff();

function throwFuncForSourceMapCheck() {
  // throw new Error("test");
  try {
    throw new Error("test");
  } catch (e) {
    console.log("catched", e);
  }
}
const subItem = sub.sub;
type ShouldKeep = {
  shouldKeep: number;
};

const shouldKeep: ShouldKeep = {
  shouldKeep: 1,
};
console.log(ext(x.l2.toString(), subItem.toString()), shouldKeep);

throwFuncForSourceMapCheck();
