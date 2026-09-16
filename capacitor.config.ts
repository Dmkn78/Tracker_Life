import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.liferegime.personal",
  appName: "Life Regime",
  webDir: "mobile-dist",
  android: { backgroundColor: "#efe8da" },
  server: { androidScheme: "https" }
};

export default config;
