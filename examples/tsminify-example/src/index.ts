import { ext } from "./ext";
import { sub } from "./sub";

type Local1 = {
  local: number;
};
type Local2 = {
  pub: number;
};

function fff(): Local2 {
  const fLocal: Local1 = { local: 1 };
  return {
    pub: fLocal.local,
  };
}
const x = fff();
const subItem = sub.subLocal;

console.log(ext(x.pub.toString(), subItem.toString()), sub);
