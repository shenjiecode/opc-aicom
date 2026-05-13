/**
 * OPC-AICom Theme Configuration
 * 
 * A modern tech/industrial minimalist design system with:
 * - Dark mode primary aesthetic
 * - Purple accent color for AI/tech feel
 * - Clean lines and clear hierarchy
 * - JetBrains Mono for code/monospace elements
 * - Plus Jakarta Sans for UI elements
 */

export const theme = {
  colors: {
    // Primary brand color - purple for AI/tech identity
    primary: {
      50: '#f5f3ff',
      100: '#ede9fe',
      200: '#ddd6fe',
      300: '#c4b5fd',
      400: '#a78bfa',
      500: '#8b5cf6',
      600: '#7c3aed',
      700: '#6d28d9',
      800: '#5b21b6',
      900: '#4c1d95',
    },
    // Neutral grays for dark theme
    gray: {
      50: '#f9fafb',
      100: '#f3f4f6',
      200: '#e5e7eb',
      300: '#d1d5db',
      400: '#9ca3af',
      500: '#6b7280',
      600: '#4b5563',
      700: '#374151',
      800: '#1f2937',
      900: '#111827',
      950: '#030712',
    },
    // Semantic colors
    success: {
      light: '#86efac',
      DEFAULT: '#22c55e',
      dark: '#15803d',
    },
    warning: {
      light: '#fde047',
      DEFAULT: '#eab308',
      dark: '#a16207',
    },
    error: {
      light: '#fca5a5',
      DEFAULT: '#ef4444',
      dark: '#b91c1c',
    },
    info: {
      light: '#93c5fd',
      DEFAULT: '#3b82f6',
      dark: '#1d4ed8',
    },
  },

  // Typography
  fonts: {
    sans: '"Plus Jakarta Sans", system-ui, -apple-system, sans-serif',
    mono: '"JetBrains Mono", "Fira Code", monospace',
  },

  // Spacing scale
  spacing: {
    '0': '0',
    '1': '0.25rem',   // 4px
    '2': '0.5rem',    // 8px
    '3': '0.75rem',   // 12px
    '4': '1rem',      // 16px
    '5': '1.25rem',   // 20px
    '6': '1.5rem',    // 24px
    '8': '2rem',      // 32px
    '10': '2.5rem',   // 40px
    '12': '3rem',     // 48px
    '16': '4rem',     // 64px
    '20': '5rem',     // 80px
    '24': '6rem',     // 96px
  },

  // Border radius
  radius: {
    none: '0',
    sm: '0.25rem',    // 4px
    DEFAULT: '0.5rem', // 8px
    md: '0.75rem',    // 12px
    lg: '1rem',       // 16px
    xl: '1.5rem',     // 24px
    full: '9999px',
  },

  // Shadows
  shadows: {
    sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    DEFAULT: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
    md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
    lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
    xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
    glow: '0 0 20px rgba(139, 92, 246, 0.3)',
  },

  // Layout dimensions
  layout: {
    headerHeight: '4rem',      // 64px
    sidebarWidth: '16rem',     // 256px
    sidebarCollapsed: '4rem',  // 64px
    maxContentWidth: '1440px',
  },

  // Transitions
  transitions: {
    fast: '150ms ease-in-out',
    DEFAULT: '200ms ease-in-out',
    slow: '300ms ease-in-out',
  },
} as const;

// CSS variable definitions for use in CSS files
export const cssVariables = {
  // Primary
  '--primary-50': theme.colors.primary[50],
  '--primary-100': theme.colors.primary[100],
  '--primary-200': theme.colors.primary[200],
  '--primary-300': theme.colors.primary[300],
  '--primary-400': theme.colors.primary[400],
  '--primary-500': theme.colors.primary[500],
  '--primary-600': theme.colors.primary[600],
  '--primary-700': theme.colors.primary[700],
  '--primary-800': theme.colors.primary[800],
  '--primary-900': theme.colors.primary[900],

  // Gray
  '--gray-50': theme.colors.gray[50],
  '--gray-100': theme.colors.gray[100],
  '--gray-200': theme.colors.gray[200],
  '--gray-300': theme.colors.gray[300],
  '--gray-400': theme.colors.gray[400],
  '--gray-500': theme.colors.gray[500],
  '--gray-600': theme.colors.gray[600],
  '--gray-700': theme.colors.gray[700],
  '--gray-800': theme.colors.gray[800],
  '--gray-900': theme.colors.gray[900],
  '--gray-950': theme.colors.gray[950],

  // Layout
  '--header-height': theme.layout.headerHeight,
  '--sidebar-width': theme.layout.sidebarWidth,
  '--sidebar-collapsed': theme.layout.sidebarCollapsed,

  // Fonts
  '--font-sans': theme.fonts.sans,
  '--font-mono': theme.fonts.mono,
};

// Export for direct usage in JS/TS
export default theme;
