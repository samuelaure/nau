import type { Config } from 'tailwindcss'

import tailwindcssAnimate from 'tailwindcss-animate'

const config: Config = {
  darkMode: ['class'],
  // `packages/ui` doesn't exist — the real package is `packages/nau-ui`
  // (`@9nau/ui`). This glob never matched, so Tailwind's purge never saw
  // that package's own class usage; harmless today only because `apps/app`
  // happens to use the same utility classes directly, not because this glob
  // was doing anything.
  content: ['./src/**/*.{ts,tsx}', '../../packages/nau-ui/src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      // Maps shadcn's standard token names (defined in globals.css as HSL
      // triples) onto Tailwind color utilities — `@9nau/ui`'s components
      // (button.tsx, card.tsx) were written assuming this mapping exists.
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
    },
  },
  plugins: [tailwindcssAnimate],
}
export default config
