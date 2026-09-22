/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--th-font-sans)"],
        mono: ["var(--th-font-mono)"],
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
        // Vote feedback: a squash-and-stretch press, a halo that swells out of
        // the button, a quick count pop and a +1 drifting off the top.
        "vibe-pop": "vibePop 0.42s cubic-bezier(0.22, 1, 0.36, 1)",
        "vibe-bump": "vibeBump 0.42s cubic-bezier(0.22, 1, 0.36, 1)",
        "vibe-halo": "vibeHalo 0.6s cubic-bezier(0.22, 1, 0.36, 1) forwards",
        // Jumping to the comments highlights them for three seconds so it is
        // clear where you landed.
        "comment-spotlight": "commentSpotlight 3s ease-out forwards",
        "comment-rise": "commentRise 0.45s cubic-bezier(0.22, 1, 0.36, 1) both",
        // Route changes slide the new view in from the right.
        "page-in": "pageIn 0.26s cubic-bezier(0.22, 1, 0.36, 1)",
        // A slow sheen across the first-place badge.
        "rank-shine": "rankShine 2.8s ease-in-out infinite",
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
        // Squash on the press, overshoot on the release. No rotation: on a
        // wide button a tilt reads as a glitch rather than a bounce.
        vibePop: {
          "0%": { transform: "scale(1)" },
          "18%": { transform: "scale(0.94)" },
          "50%": { transform: "scale(1.05)" },
          "100%": { transform: "scale(1)" },
        },
        // The count stays put and pops in place; making it jump out of the
        // button looked like a layout break.
        vibeBump: {
          "0%": { transform: "scale(1)" },
          "40%": { transform: "scale(1.28)" },
          "100%": { transform: "scale(1)" },
        },
        // A filled halo swelling out of the button, rather than a hard border
        // ring scaling up, which read as an outline artefact.
        pageIn: {
          "0%": { opacity: "0", transform: "translateX(1.25rem)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        rankShine: {
          "0%, 65%, 100%": { boxShadow: "0 0 0 0 rgb(245 197 24 / 0)" },
          "80%": { boxShadow: "0 0 0 4px rgb(245 197 24 / 0.35)" },
        },
        commentSpotlight: {
          "0%": { backgroundColor: "rgb(148 163 184 / 0.20)" },
          "55%": { backgroundColor: "rgb(148 163 184 / 0.14)" },
          "100%": { backgroundColor: "rgb(148 163 184 / 0)" },
        },
        commentRise: {
          "0%": { opacity: "0", transform: "translateY(0.5rem)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        vibeHalo: {
          "0%": { opacity: "0.32", transform: "scale(1)" },
          "100%": { opacity: "0", transform: "scale(1.28)" },
        },
      },
    },
  },
  plugins: [require("@tailwindcss/typography"), require("tailwindcss-animate")],
};
