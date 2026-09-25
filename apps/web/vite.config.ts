import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";

export default defineConfig({
  resolve: {
    alias: {
      "@simarium/render-core": fileURLToPath(new URL("../../packages/render-core/src/index.ts", import.meta.url))
    }
  },
  build: {
    outDir: "../../dist-render",
    emptyOutDir: true,
    sourcemap: true,
    target: "es2022"
  }
});
