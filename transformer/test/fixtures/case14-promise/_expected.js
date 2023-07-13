function j(id) {
  return new Promise((resolve, reject) => {
    // Simulate fetching data
    setTimeout(() => {
      if (id >= 0) {
        // TODO: resolve is no mangle-related function
        resolve({ __id: id, __value: `Value ${id}` });
      } else {
        reject(new Error("Invalid ID"));
      }
    }, 1000);
  });
}
async function run() {
  // Use the Promise-returning function
  const q = j(1);
  // Use the Promise-returning function with async/await
  const z = j(2);
  // Promise.all
  const p = Promise.all([j(3), j(4), j(5)]);
  // Promise.race
  const f = Promise.race([j(6), j(7), j(8)]);
  const y = await Promise.all([q, z, p, f]);
  // Flatten the results (the Promise.all result is an array of Data)
  return y.flat().map((result) => ({
    id: result.__id,
    value: result.__value,
  }));
}
async function w(id) {
  return {
    k: id,
    x: `Value ${id}`,
  };
}
async function run2() {
  const g = [];
  for (let b = 0; b < 10; b++) {
    const v = await w(b);
    g.push({
      id: v.k,
      value: v.x,
    });
  }
  return g;
}

export { run, run2 };
