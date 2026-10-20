/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ground: 'var(--ground)',
        surface: 'var(--surface)',
        raised: 'var(--raised)',
        line: 'var(--border)',
        rule: 'var(--rule)',
        control: 'var(--control)',
        ink: 'var(--text)',
        muted: 'var(--muted)',
        primary: 'var(--primary)',
        signal: 'var(--signal)',
        positive: 'var(--positive)',
        negative: 'var(--negative)',
      },
      fontFamily: {
        sans: ['"Geist Variable"', 'Geist', 'system-ui', 'sans-serif'],
        mono: ['"Geist Mono Variable"', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        card: '8px',
        control: '6px',
      },
      boxShadow: {
        // Only for what floats: menus, dialogs, toasts.
        float: '0 8px 24px rgba(10, 10, 10, 0.12), 0 0 0 1px rgba(10, 10, 10, 0.05)',
      },
    },
  },
  plugins: [],
}
