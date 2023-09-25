import process from "node:process";

import { analyzeDts } from "./commands/analyzeDts.mjs";
import { doctor } from "./commands/doctor.mjs";
import { init } from "./commands/init.mjs";

async function run(cmd: string) {
  switch (cmd) {
    case "init": {
      await init();
      break;
    }
    case "doctor": {
      await doctor();
      break;
    }
    case "analyze-dts": {
      await analyzeDts();
      break;
    }
    default: {
      console.error("[packelyze] Unknown command", cmd);
    }
  }
}

const cmd = process.argv[2];
run(cmd).catch((e) => {
  console.error(e);
  process.exit(1);
});
