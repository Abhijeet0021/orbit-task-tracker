// The client owns the real Tailwind configuration; this file exists so a build
// run from the repository root resolves the same theme. Keep it a re-export so
// the two cannot drift apart.
import clientConfig from './client/tailwind.config.js';

/** @type {import('tailwindcss').Config} */
export default {
  ...clientConfig,
  content: [
    "./client/index.html",
    "./client/src/**/*.{js,ts,jsx,tsx}",
  ],
};
