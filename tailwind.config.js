/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "#F8F7F7",
        text: "#525252",
        header: "#2A2825",
        accent: "#2A2825",
        altGrey: "#787672",
        altBackground: "#F4F0ED",
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
};
