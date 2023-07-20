export const results = [1, 2, 3, 4, 5, 6, 7, 8, 9]
  .map((x) => {
    return {
      vvv: x,
    };
  })
  .filter((x) => x.vvv % 2 === 0)
  .map((x) => {
    return {
      www: x.vvv * 2,
    };
  });
