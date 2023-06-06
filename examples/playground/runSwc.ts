import swc from "@swc/core";
import analyzed from "./_optools-analyzed.json";

const out = await swc
  .transform("export const obj = {xxx: 1}", {
    // Some options cannot be specified in .swcrc
    filename: "input.js",
    sourceMaps: true,
    // Input files are treated as module by default.
    isModule: true,
    // All options below can be configured via .swcrc
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
  });

console.log(out.code);
