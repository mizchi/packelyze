import { defineConfig } from "vite";

export default defineConfig({
  test: {
    includeSource: ["src/**/*.{js,ts,mts}"],
  },
});
