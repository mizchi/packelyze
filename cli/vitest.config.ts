import { defineConfig } from "vite";

export default defineConfig({
  test: {
    hookTimeout: 30000,
    teardownTimeout: 30000,
    includeSource: ["src/**/*.{js,ts,mts}"],
  },
});
