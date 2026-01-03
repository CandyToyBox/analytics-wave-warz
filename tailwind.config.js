/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./hooks/**/*.{js,ts,jsx,tsx}",
    "./services/**/*.{js,ts,jsx,tsx}",
    "./utils/**/*.{js,ts,jsx,tsx}",
    "./types/**/*.{js,ts,jsx,tsx}",
    "./App.tsx",
    "./index.tsx",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          950: '#0D1321', // Primary BG: Deep Space Navy
          900: '#151e32', // Secondary BG
          800: '#2D3748', // UI Element: Medium Gray
          700: '#4A5568', // Lighter Border
        },
        wave: {
          blue: '#22B5E8', // Primary Brand: Wave Blue
          green: '#6FF34B', // Primary Brand: Wave Green
          sage: '#95fe7c',  // Logo Green
        },
        action: {
          green: '#16C784', // Functional Success
        },
        alert: {
          red: '#EA3943',   // Functional Alert
        },
        ui: {
          gray: '#A0AEC0',  // UI Element: Light Gray
        }
      },
      fontFamily: {
        sans: ['Rajdhani', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
      }
    }
  },
  plugins: [],
}
