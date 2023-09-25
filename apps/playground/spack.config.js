const { config } = require("@swc/core/spack");
const analyzed = require("./_packelyze-analyzed.json");

module.exports = config({
  options: {
    jsc: {
      minify: {
        mangle: {
          props: {
            regex: "^.*",
            reserved: analyzed.reserved,
            undeclared: false,
          },
        },
      },
    },
    minify: true,
  },
  entry: {
    main: __dirname + "/src/index.ts",
  },
  output: {
    path: __dirname + "/dist-swc",
  },
  module: {},
});
