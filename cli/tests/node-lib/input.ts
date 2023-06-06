import { parseArgs } from "node:util";

console.log(parseArgs({
  args: process.argv.slice(2),
  options: {
    debug: {
      type: "boolean",
      short: "d",
    },
  },
}));

console.log(process.env.NODE_ENV);
