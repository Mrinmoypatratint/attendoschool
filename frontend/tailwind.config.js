/** @type {import('tailwindcss').Config} */
import plugin from 'tailwindcss/plugin';
import flattenColorPaletteModule from 'tailwindcss/lib/util/flattenColorPalette';

const flattenColorPalette = flattenColorPaletteModule.default || flattenColorPaletteModule;

/*
 * UI reskin (UI_RESKIN_PLAN.md): the Tailwind palette is re-mapped onto the design tokens so every
 * existing utility class adopts the flat school system without touching component logic.
 *   blue / indigo / pink / primary → primary (#e11d55)    violet / purple / sky / cyan → info (#5c6bc0)
 *   slate / gray / zinc / neutral / stone → neutral greys  emerald / green / teal / lime → success (#03806a)
 *   amber / yellow / orange → warning (#e9a23b)            red / rose / fuchsia → destructive (#d32f2f)
 */
const primary = { 50: '#fff2f4', 100: '#ffe1e8', 200: '#fcc3d1', 300: '#f896b0', 400: '#ef5a85', 500: '#e11d55', 600: '#e11d55', 700: '#c0174a', 800: '#9a133c', 900: '#7a1031', 950: '#4d0a1f' };
const neutral = { 50: '#f9f9fa', 100: '#f5f5f6', 200: '#eaeaec', 300: '#d4d5d9', 400: '#94969f', 500: '#696e79', 600: '#535766', 700: '#3e4152', 800: '#282c3f', 900: '#1c1f2e', 950: '#121212' };
const success = { 50: '#e6f2f0', 100: '#cce6e1', 200: '#99ccc3', 300: '#66b3a6', 400: '#339988', 500: '#03806a', 600: '#03806a', 700: '#02604f', 800: '#024035', 900: '#01302a', 950: '#01201b' };
const warning = { 50: '#fdf5e9', 100: '#fbecd3', 200: '#f6dcb2', 300: '#f2c785', 400: '#edb35f', 500: '#e9a23b', 600: '#b8781c', 700: '#8f5c12', 800: '#6b450e', 900: '#4a300a', 950: '#2e1e06' };
const destructive = { 50: '#fbeaea', 100: '#f7d5d5', 200: '#f2c0c0', 300: '#e88d8d', 400: '#dd5c5c', 500: '#d32f2f', 600: '#d32f2f', 700: '#a82424', 800: '#7e1b1b', 900: '#541212', 950: '#2a0909' };
const info = { 50: '#eef0f9', 100: '#dde1f2', 200: '#c9cee9', 300: '#a3abda', 400: '#7f8ccd', 500: '#5c6bc0', 600: '#5c6bc0', 700: '#48549a', 800: '#363f73', 900: '#242a4d', 950: '#121526' };

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: ['class', '[data-theme="dark"]'],
  corePlugins: {
    // Preserve custom CSS resets and native button/input form styling from styles.css
    preflight: false,
  },
  theme: {
    // 4px everywhere; avatars/dots/pills keep `rounded-full`.
    borderRadius: {
      none: '0', xs: '4px', sm: '4px', DEFAULT: '4px', md: '4px', lg: '4px', xl: '4px', '2xl': '4px', '3xl': '4px',
      full: '9999px', pill: '9999px',
    },
    // Panels are flat; only floating layers get the single small shadow.
    boxShadow: {
      none: 'none', sm: 'none', DEFAULT: 'none', inner: 'none',
      md: '0 4px 12px rgba(40,44,63,0.08)', lg: '0 4px 12px rgba(40,44,63,0.08)',
      xl: '0 4px 12px rgba(40,44,63,0.08)', '2xl': '0 4px 12px rgba(40,44,63,0.08)',
    },
    backdropBlur: { none: '0', sm: '0', DEFAULT: '0', md: '0', lg: '0', xl: '0', '2xl': '0', '3xl': '0' },
    blur: { none: '0', sm: '0', DEFAULT: '0', md: '0', lg: '0', xl: '0', '2xl': '0', '3xl': '0' },
    extend: {
      colors: {
        primary, blue: primary, indigo: primary, pink: primary,
        violet: info, purple: info, sky: info, cyan: info,
        slate: neutral, gray: neutral, zinc: neutral, neutral, stone: neutral,
        emerald: success, green: success, teal: success, lime: success,
        amber: warning, yellow: warning, orange: warning,
        red: destructive, rose: destructive, fuchsia: destructive,
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        card: 'var(--card)',
        accent: 'var(--accent)',
        muted: 'var(--muted)',
        'muted-foreground': 'var(--muted-foreground)',
        border: 'var(--border)',
        input: 'var(--input)',
        ring: 'var(--ring)',
        success: 'var(--success)',
        warning: 'var(--warning)',
        destructive: 'var(--destructive)',
        info: 'var(--info)',
      },
      fontFamily: {
        sans: ['Assistant', 'ui-sans-serif', 'system-ui', '-apple-system', '"Segoe UI"', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [
    // Gradients are banned: `bg-gradient-*` is neutralised in theme/components.css and every `from-*`
    // utility also sets a flat background-color, so gradient elements keep their (flat) colour.
    plugin(({ matchUtilities, theme }) => {
      matchUtilities(
        { from: (value) => ({ 'background-color': value }) },
        { values: flattenColorPalette(theme('colors')), type: ['color', 'any'] },
      );
    }),
  ],
};
