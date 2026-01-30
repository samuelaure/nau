import type { Config } from "tailwindcss";

const config: Config = {
    content: [
        "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    ],
    theme: {
        extend: {
            colors: {
                background: "#0d0d0d",
                panel: "#1a1a1a",
                accent: {
                    DEFAULT: "#7c3aed",
                    hover: "#6d28d9",
                },
                text: {
                    primary: "#ffffff",
                    secondary: "#a1a1aa",
                },
                border: "#27272a",
                input: "#1e1e20",
                success: "#10b981",
                error: "#ef4444",
            },
            fontFamily: {
                sans: ["Inter", "sans-serif"],
                heading: ["Outfit", "sans-serif"],
            },
            backgroundImage: {
                "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
                "gradient-conic":
                    "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
            },
        },
    },
    plugins: [],
};
export default config;
