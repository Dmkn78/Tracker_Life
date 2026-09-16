import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";

const require = createRequire(import.meta.url);
const iconRoot = resolve(dirname(require.resolve("lucide-react/package.json")), "dist/esm");
const iconExports = new Map<string, string>();
const previewProxy = { "/api": { target: process.env.MOBILE_PREVIEW_API ?? "http://127.0.0.1:8000", changeOrigin: true } };
for (const declaration of readFileSync(resolve(iconRoot, "lucide-react.mjs"), "utf8").matchAll(/export \{ ([^}]+) \} from '([^']+)'/g)) {
  for (const name of declaration[1].matchAll(/default as (\w+)/g)) iconExports.set(name[1], resolve(iconRoot, declaration[2]));
}

export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  base: "./",
  plugins: [{
    name: "mobile-direct-icon-imports",
    enforce: "pre",
    transform(source, id) {
      if (!/\.tsx?$/.test(id) || id.includes("node_modules")) return null;
      // Avoid parsing the entire icon catalogue on memory-constrained build machines.
      return source.replace(/import \{([^}]+)\} from ["']lucide-react["'];?/g, (_, names: string) =>
        names.split(",").map((name) => {
          const symbol = name.trim();
          const path = iconExports.get(symbol);
          if (!path) throw new Error(`Unknown mobile icon: ${symbol}`);
          return `import ${symbol} from ${JSON.stringify(path.replaceAll("\\", "/"))};`;
        }).join("\n"));
    }
  }],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("..", import.meta.url)),
      "next/link": fileURLToPath(new URL("./MobileLink.tsx", import.meta.url))
    },
    dedupe: ["react", "react-dom"]
  },
  build: {
    outDir: "../mobile-dist", emptyOutDir: true,
    rollupOptions: { onwarn(warning, warn) { if (warning.code !== "MODULE_LEVEL_DIRECTIVE" && warning.code !== "SOURCEMAP_ERROR") warn(warning); } }
  },
  server: { host: "127.0.0.1", port: 4173, strictPort: true, proxy: previewProxy },
  preview: { host: "127.0.0.1", port: 4173, strictPort: true, proxy: previewProxy }
});
