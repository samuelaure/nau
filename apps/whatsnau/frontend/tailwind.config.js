/** @type {import('tailwindcss').Config} */
export default {
    content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
    theme: {
        extend: {
            colors: {
                primary: '#7c7cff',
                'primary-glow': 'rgba(124, 124, 255, 0.3)',
                secondary: '#3b0764',
                accent: '#d946ef',
                success: '#10b981',
                warning: '#f59e0b',
                danger: '#ef4444',
            },
            backgroundColor: {
                main: '#0c0a15',
                card: 'rgba(255, 255, 255, 0.03)',
            },
            borderColor: {
                card: 'rgba(255, 255, 255, 0.08)',
            },
            textColor: {
                main: '#ffffff',
                muted: 'rgba(255, 255, 255, 0.6)',
            },
        },
    },
    plugins: [],
};
