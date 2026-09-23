// Tailwind is only pulled in by stylesheets that import it (the shadcn trial's
// trial.css). globals.css does not, so the rest of the app is untouched.
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
