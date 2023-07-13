type InternalData = {
  __id: number;
  __value: string;
};

type InternalData2 = {
  __id: number;
  __value: string;
};

export type Data = {
  id: number;
  value: string;
};

function fetchData(id: number): Promise<InternalData> {
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

export async function run(): Promise<Data[]> {
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
    id: result.__id,
    value: result.__value,
  }));
}

async function fetchData2(id: number): Promise<InternalData2> {
  return {
    __id: id,
    __value: `Value ${id}`,
  };
}

export async function run2(): Promise<Data[]> {
  const data: Data[] = [];
  for (let i = 0; i < 10; i++) {
    const result = await fetchData2(i);
    data.push({
      id: result.__id,
      value: result.__value,
    });
  }
  return data;
}
