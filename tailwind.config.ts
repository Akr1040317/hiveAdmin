import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: {
          DEFAULT: '#0a0a0a',
          card: '#1a1a1a',
          hover: '#252525',
        },
        border: {
          DEFAULT: '#2a2a2a',
          light: '#3a3a3a',
        },
      },
    },
  },
  plugins: [],
}
export default config
