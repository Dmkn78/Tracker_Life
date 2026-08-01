import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./features/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#f8fafc",
        muted: "#9ba3b4",
        paper: "#0d1118",
        shell: "#131923",
        panel: "#161d29",
        panel2: "#1b2230",
        line: "#2a3140",
        accent: "#8da2fb",
        violet: "#8070ff",
        blueglass: "#b8c7ff",
        good: "#57c59a",
        warn: "#f0c56b",
        risk: "#f08b8f"
      }
    }
  },
  plugins: []
};

export default config;
