import { defineConfig } from "vite";
import { MINIMUM_MOBILE_NATIVE_BUILD } from "./nativeCompatibility";
import { fileURLToPath } from "node:url";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";

const require = createRequire(import.meta.url);
const iconRoot = resolve(dirname(require.resolve("lucide-react/package.json")), "dist/esm");
const iconExports = new Map<string, string>();
const previewProxy = { "/api": { target: process.env.MOBILE_PREVIEW_API ?? "http://127.0.0.1:8000", changeOrigin: true } };
for (const declaration of readFileSync(resolve(iconRoot, "lucide-react.mjs"), "utf8").matchAll(/export \{ ([^}]+) \} from '([^']+)'/g)) {
  for (const name of declaration[1].matchAll(/default as (\w+)/g)) iconExports.set(name[1], resolve(iconRoot, declaration[2]));
}

export default defineConfig(({ mode }) => {
const hosted = mode === "hosted";
const version = process.env.NEXT_PUBLIC_WEBSITE_VERSION ?? randomUUID();
const builtAt = process.env.MOBILE_BUILD_TIME ?? new Date().toISOString();
return {
  root: fileURLToPath(new URL(".", import.meta.url)),
  base: hosted ? "/mobile-app/" : "./",
  define: { __MOBILE_BUILD_VERSION__: JSON.stringify(version), __MOBILE_BUILD_TIME__: JSON.stringify(builtAt) },
  plugins: [{
    name: "publish-mobile-interface",
    closeBundle() {
      if (!hosted) return;
      const directory = fileURLToPath(new URL("../public/mobile-app", import.meta.url));
      mkdirSync(directory, { recursive: true });
      writeFileSync(resolve(directory, "release.json"), JSON.stringify({ schema: 1, version, builtAt, minNativeBuild: MINIMUM_MOBILE_NATIVE_BUILD, entry: "/mobile-app/index.html" }, null, 2));
    }
  }, {
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
      "next/link": fileURLToPath(new URL("./MobileLink.tsx", import.meta.url)),
      "next/navigation": fileURLToPath(new URL("./MobileNavigation.ts", import.meta.url))
    },
    dedupe: ["react", "react-dom"]
  },
  build: {
    outDir: hosted ? "../public/mobile-app" : "../mobile-dist", emptyOutDir: !hosted,
    rollupOptions: { onwarn(warning, warn) { if (warning.code !== "MODULE_LEVEL_DIRECTIVE" && warning.code !== "SOURCEMAP_ERROR") warn(warning); } }
  },
  server: { host: "127.0.0.1", port: 4173, strictPort: true, proxy: previewProxy },
  preview: { host: "127.0.0.1", port: 4173, strictPort: true, proxy: previewProxy }
};
});
