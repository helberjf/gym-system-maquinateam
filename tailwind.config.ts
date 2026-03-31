import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/features/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Paleta de cores Maquina Team
        brand: {
          red: '#C8102E',       // vermelho boxe / agressivo
          'red-dark': '#8B0000',
          black: '#0A0A0A',
          'gray-dark': '#1A1A1A',
          'gray-mid': '#2D2D2D',
          'gray-light': '#6B7280',
          white: '#F9FAFB',
          gold: '#D4AF37',       // destaque premium
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        heading: ['var(--font-heading)', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        'gradient-brand': 'linear-gradient(135deg, #C8102E 0%, #8B0000 100%)',
        'gradient-dark': 'linear-gradient(180deg, #0A0A0A 0%, #1A1A1A 100%)',
      },
    },
  },
  plugins: [],
};

export default config;
