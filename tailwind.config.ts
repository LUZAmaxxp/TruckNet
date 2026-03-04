import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        /* shadcn compatibility */
        border:      "hsl(var(--border))",
        input:       "hsl(var(--input))",
        ring:        "hsl(var(--ring))",
        background:  "hsl(var(--background))",
        foreground:  "hsl(var(--foreground))",
        primary: {
          DEFAULT:    "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT:    "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT:    "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT:    "hsl(var(--muted-bg))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT:    "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT:    "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT:    "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        /* — Warm Maritime Palette — */
        base:     { DEFAULT: "var(--base)",     2: "var(--base-2)" },
        surface:  { DEFAULT: "var(--surface)",  2: "var(--surface-2)" },
        navy: {
          DEFAULT: "var(--navy)",
          md:      "var(--navy-md)",
          lt:      "var(--navy-lt)",
          pale:    "var(--navy-pale)",
        },
        sage: {
          DEFAULT: "var(--sage)",
          lt:      "var(--sage-lt)",
          md:      "var(--sage-md)",
        },
        terra: {
          DEFAULT: "var(--terra)",
          lt:      "var(--terra-lt)",
          md:      "var(--terra-md)",
        },
        honey: {
          DEFAULT: "var(--honey)",
          lt:      "var(--honey-lt)",
          md:      "var(--honey-md)",
        },
        slate: {
          DEFAULT: "var(--slate)",
          lt:      "var(--slate-lt)",
        },
        ink:      { DEFAULT: "var(--ink)",      2: "var(--ink-2)" },
        subtle:   { DEFAULT: "var(--subtle)" },
        hairline: { DEFAULT: "var(--hairline)", 2: "var(--hairline-2)" },
      },
      fontFamily: {
        display: ["var(--font-display)"],
        body:    ["var(--font-body)"],
        mono:    ["var(--font-mono)"],
      },
      boxShadow: {
        xs:  "var(--shadow-xs)",
        sm:  "var(--shadow-sm)",
        md:  "var(--shadow-md)",
        lg:  "var(--shadow-lg)",
        nav: "var(--shadow-nav)",
      },
      borderRadius: {
        sm:   "8px",
        DEFAULT: "12px",
        lg:   "16px",
        xl:   "20px",
        "2xl": "24px",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to:   { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to:   { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up":   "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [],
};

export default config;
