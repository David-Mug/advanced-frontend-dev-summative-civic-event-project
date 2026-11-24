/**
 * Tailwind configuration for CivicEvents+.
 * Brand colours are the same values as the CSS custom properties declared in
 * css/tailwind.input.css (:root). They are written as hex here because Tailwind v3 needs
 * literal colours to support opacity modifiers such as bg-brand/20. Keep both in sync.
 */
module.exports = {
  content: ['./index.html', './pages/**/*.html', './js/**/*.js', '!./js/vendor/**'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#2087E7',
          strong: '#1769C2',
          deep: '#0F4F94',
          light: '#E9F5FF',
        },
        accent: { DEFAULT: '#F4D531', soft: '#FDF6D3' },
        ink: { DEFAULT: '#252525', muted: '#64748B', soft: '#475569' },
        line: '#E2E8F0',
        success: { DEFAULT: '#16A34A', text: '#15803D' },
        danger: '#DC2626',
      },
      fontFamily: {
        heading: ['Manrope', 'system-ui', 'sans-serif'],
        sans: ['"DM Sans"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(15, 40, 80, 0.04), 0 4px 16px rgba(15, 40, 80, 0.06)',
        lift: '0 8px 28px rgba(32, 135, 231, 0.16)',
      },
      borderRadius: { xl2: '1.25rem' },
    },
  },
  plugins: [],
};
