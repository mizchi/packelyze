const ts = require("rollup-plugin-ts");
const terser = require("@rollup/plugin-terser");
const resolve = require("@rollup/plugin-node-resolve").default;
const commonjs = require("@rollup/plugin-commonjs");

const configSet = (input) => {
  const name = input
    .replace("src/", "")
    .replace(/\.tsx?$/, "");
  return ([
    {
      input,
      output: {
        dir: "dist",
        format: "esm",
      },  
      plugins: [
        commonjs(),
        resolve(),
        ts({
          declaration: false,
        }),
        terser({})
      ],  
    },
    {
      input,
      output: {
        dir: "dist-optools",
        format: "esm",
      },  
      plugins: [
        commonjs(),
        resolve(),
        ts({
          declaration: false,
        }),
        terser({
          mangle: {
            properties: {
              regex: /^.*$/,
              reserved: require(`./_analyzed-${name}.json`)
            }
          }
        }
      )],  
    }
  ])
};

module.exports = [
  ...configSet("src/hono.ts"),
  ...configSet("src/hono-usage.ts"),
  ...configSet("src/react-library.tsx"),
  ...configSet("src/zod-usage.ts"),
  ...configSet("src/typescript.ts"),
]
