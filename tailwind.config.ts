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
          elevated: '#1f1f1f',
        },
        border: {
          DEFAULT: '#2a2a2a',
          light: '#3a3a3a',
          subtle: '#1f1f1f',
        },
        // Secondary accent colors (blue/purple/pink)
        accent: {
          blue: {
            light: '#60a5fa',
            DEFAULT: '#3b82f6',
            dark: '#2563eb',
            subtle: 'rgba(59, 130, 246, 0.1)',
            border: 'rgba(59, 130, 246, 0.2)',
          },
          purple: {
            light: '#a78bfa',
            DEFAULT: '#8b5cf6',
            dark: '#7c3aed',
            subtle: 'rgba(139, 92, 246, 0.1)',
            border: 'rgba(139, 92, 246, 0.2)',
          },
          pink: {
            light: '#f472b6',
            DEFAULT: '#ec4899',
            dark: '#db2777',
            subtle: 'rgba(236, 72, 153, 0.1)',
            border: 'rgba(236, 72, 153, 0.2)',
          },
        },
      },
      borderRadius: {
        'notion': '8px',
        'notion-lg': '12px',
      },
      spacing: {
        'grid': '8px',
      },
      transitionDuration: {
        'notion': '150ms',
        'notion-slow': '200ms',
      },
    },
  },
  plugins: [],
}
export default config
