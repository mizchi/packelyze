import { LocalObj } from "./types";

const createLocalObj = (): LocalObj => {
  return {
    local: 1,
  };
};

export function runLocal() {
  const localObj = createLocalObj();
  console.log(localObj.local);
}
