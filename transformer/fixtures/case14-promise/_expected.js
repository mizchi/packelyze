function fetchData(id) {
  return new Promise((resolve, reject) => {
    // Simulate fetching data
    setTimeout(() => {
      if (id >= 0) {
        // TODO: resolve is no mangle-related function
        resolve({ /*__id*/ k: id, /*__value*/ x: `Value ${id}` });
      } else {
        reject(new Error("Invalid ID"));
      }
    }, 1000);
  });
}
async function run() {
  // Use the Promise-returning function
  const p1 = fetchData(1);
  // Use the Promise-returning function with async/await
  const p2 = fetchData(2);
  // Promise.all
  const pAll = Promise.all([fetchData(3), fetchData(4), fetchData(5)]);
  // Promise.race
  const pRace = Promise.race([fetchData(6), fetchData(7), fetchData(8)]);
  const results = await Promise.all([p1, p2, pAll, pRace]);
  // Flatten the results (the Promise.all result is an array of Data)
  return results.flat().map((result) => ({
    id: result./*__id*/ k,
    value: result./*__value*/ x,
  }));
}
async function fetchData2(id) {
  return {
    /*__id*/ j: id,
    /*__value*/ q: `Value ${id}`,
  };
}
async function run2() {
  const data = [];
  for (let i = 0; i < 10; i++) {
    const result = await fetchData2(i);
    data.push({
      id: result./*__id*/ j,
      value: result./*__value*/ q,
    });
  }
  return data;
}

export { run, run2 };
