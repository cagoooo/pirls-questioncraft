
import type { Config } from "tailwindcss";

export default {
    darkMode: ["class"],
    content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
  	extend: {
  		colors: {
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
  			},
  			sidebar: {
  				DEFAULT: 'hsl(var(--sidebar-background))',
  				foreground: 'hsl(var(--sidebar-foreground))',
  				primary: 'hsl(var(--sidebar-primary))',
  				'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
  				accent: 'hsl(var(--sidebar-accent))',
  				'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
  				border: 'hsl(var(--sidebar-border))',
  				ring: 'hsl(var(--sidebar-ring))'
  			},
  			// 日式教育派 / 奶油原色色票（README 完整 token）
  			cream:      '#FFF9EE',
  			'cream-deep': '#FBF1DC',
  			ink:        '#3D2E1E',
  			'ink-soft': '#5C4733',
  			line:       '#E5DBC8',
  			peach:      '#F5C9A8',
  			'peach-deep': '#E89B7B',
  			sage:       '#9BBE9C',
  			'sage-deep': '#5E9968',
  			sky:        '#A8C8E8',
  			'sky-deep': '#6B9DCF',
  			lemon:      '#F2DC83',
  			rose:       '#F0A6B5',
  			coral:      '#E89B7B',
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 4px)',
  			sm: 'calc(var(--radius) - 8px)',
  			'2xl': '1.75rem',
  		},
  		boxShadow: {
  			'neo-sm': '0 3px 0 #3D2E1E',
  			'neo':    '0 4px 0 #3D2E1E',
  			'neo-lg': '0 6px 0 #3D2E1E',
  			'neo-xl': '0 8px 0 #3D2E1E',
  		},
  		fontFamily: {
  			display: ['"Plus Jakarta Sans"', '"Noto Sans TC"', 'system-ui', 'sans-serif'],
  		},
  		keyframes: {
  			'accordion-down': {
  				from: { height: '0' },
  				to: { height: 'var(--radix-accordion-content-height)' }
  			},
  			'accordion-up': {
  				from: { height: 'var(--radix-accordion-content-height)' },
  				to: { height: '0' }
  			},
  			'bounce-subtle': {
  				'0%, 100%': { transform: 'translateY(-4%)', animationTimingFunction: 'cubic-bezier(0.8,0,1,1)' },
  				'50%': { transform: 'translateY(0)', animationTimingFunction: 'cubic-bezier(0,0,0.2,1)' },
  			},
  			'pirls-spin': {
  				'0%': { transform: 'rotate(0deg)' },
  				'100%': { transform: 'rotate(360deg)' },
  			},
  			'pirls-bob': {
  				'0%, 100%': { transform: 'translateY(0) rotate(-6deg)' },
  				'50%': { transform: 'translateY(-8px) rotate(6deg)' },
  			},
  		},
  		animation: {
  			'accordion-down': 'accordion-down 0.2s ease-out',
  			'accordion-up': 'accordion-up 0.2s ease-out',
  			'bounce-subtle': 'bounce-subtle 1.5s infinite',
  			'pirls-spin': 'pirls-spin 1.6s linear infinite',
  			'pirls-bob':  'pirls-bob 3s ease-in-out infinite',
  		}
  	}
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
