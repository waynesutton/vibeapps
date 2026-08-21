/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter var", "sans-serif"],
        "alfa-slab-one": ['"Alfa Slab One"', "cursive"],
      },
      colors: {
        // Theme tokens driven by CSS variables (light / classic / dark)
        canvas: "var(--th-canvas)",
        surface: {
          DEFAULT: "var(--th-surface)",
          alt: "var(--th-surface-alt)",
          hover: "var(--th-surface-hover)",
        },
        ink: "var(--th-ink)",
        copy: "var(--th-copy)",
        soft: "var(--th-soft)",
        faint: "var(--th-faint)",
        hairline: {
          DEFAULT: "var(--th-hairline)",
          strong: "var(--th-hairline-strong)",
        },
        cta: {
          DEFAULT: "var(--th-cta)",
          hover: "var(--th-cta-hover)",
        },
        "on-cta": "var(--th-on-cta)",
        brand: {
          DEFAULT: "var(--th-brand)",
          soft: "var(--th-brand-soft)",
        },
        background: "#F3F4F6",
        text: "#525252",
        header: "#292929",
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        altGrey: "#545454",
        altBackground: "#F4F0ED",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        chart: {
          1: "hsl(var(--chart-1))",
          2: "hsl(var(--chart-2))",
          3: "hsl(var(--chart-3))",
          4: "hsl(var(--chart-4))",
          5: "hsl(var(--chart-5))",
        },
      },
      borderRadius: {
        DEFAULT: "0.25rem",
        sm: "0.25rem",
        md: "0.25rem",
        lg: "0.25rem",
        xl: "0.25rem",
        "2xl": "0.25rem",
        "3xl": "0.25rem",
      },
      animation: {
        "fade-in": "fadeIn 0.2s ease-out",
      },
      keyframes: {
        fadeIn: {
          "0%": {
            opacity: "0",
            transform: "translateY(-10px)",
          },
          "100%": {
            opacity: "1",
            transform: "translateY(0)",
          },
        },
      },
    },
  },
  plugins: [require("@tailwindcss/typography"), require("tailwindcss-animate")],
};
