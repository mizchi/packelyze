import "node:path";

const sub = {
  /*subLocal*/ k: 1,
};

const subItem = sub./*subLocal*/ k;

export { subItem };
