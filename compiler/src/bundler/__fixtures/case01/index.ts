export { ext } from "./ext";
import { sub } from "./sub";

type Local = {
  local: number;
};
type Pub = {
  pub: number;
};

function fff(): Pub {
  const fLocal: Local = { local: 1 };
  return {
    pub: fLocal.local,
  };
}
export const x = fff();
export const subItem = sub.subLocal;
