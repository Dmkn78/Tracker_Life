import type { Config } from "tailwindcss";

/** Reads a `--color-x: R G B` custom property so Tailwind's alpha modifiers (`bg-accent/12`) keep working. */
function withOpacity(cssVariable: string) {
  return `rgb(var(${cssVariable}) / <alpha-value>)`;
}

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./features/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        ink: withOpacity("--color-ink"),
        muted: withOpacity("--color-muted"),
        paper: withOpacity("--color-paper"),
        shell: withOpacity("--color-shell"),
        panel: withOpacity("--color-panel"),
        panel2: withOpacity("--color-panel2"),
        line: withOpacity("--color-line"),
        accent: withOpacity("--color-accent"),
        onaccent: withOpacity("--color-onaccent"),
        violet: withOpacity("--color-violet"),
        blueglass: withOpacity("--color-blueglass"),
        good: withOpacity("--color-good"),
        warn: withOpacity("--color-warn"),
        risk: withOpacity("--color-risk")
      }
    }
  },
  plugins: []
};

export default config;
