/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // Рабочий фон расчётного контура — холоднее и темнее, чем в производственном модуле
        canvas: "#EEF1F5",
        line: {
          DEFAULT: "#D8DEE7",
          strong: "#BCC5D1",
          soft: "#E7EBF1",
        },
        ink: {
          950: "#0B1B26",
          900: "#12293A",
          800: "#1C3648",
          700: "#33475B",
          600: "#4A5C6E",
          500: "#6B7C8D",
          400: "#8E9CAA",
        },
        steel: {
          900: "#0F2E3D",
          800: "#164256",
          700: "#1D566F",
          600: "#256A88",
        },
        accent: {
          DEFAULT: "#1D4ED8",
          soft: "#EAF0FE",
          line: "#BFD0F7",
        },
        paid: {
          DEFAULT: "#15803D",
          soft: "#ECFDF3",
          line: "#B7E4C7",
        },
        pending: {
          DEFAULT: "#B45309",
          soft: "#FEF6E7",
          line: "#F3D9A4",
        },
        reject: {
          DEFAULT: "#B91C1C",
          soft: "#FEF0F0",
          line: "#F2C2C2",
        },
      },
      boxShadow: {
        panel: "0 1px 1px rgba(11, 27, 38, 0.04), 0 2px 10px rgba(11, 27, 38, 0.06)",
        overlay: "0 24px 60px rgba(11, 27, 38, 0.28)",
      },
      fontFamily: {
        sans: ["Segoe UI", "Inter", "system-ui", "-apple-system", "Roboto", "Arial", "sans-serif"],
        num: ["Consolas", "SF Mono", "Menlo", "Segoe UI", "monospace"],
      },
      fontSize: {
        "2xs": ["10px", "14px"],
      },
    },
  },
  plugins: [],
};
