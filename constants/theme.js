export const theme = {
  colors: {
    primary: '#00C26F',
    primaryDark: '#00AC62',
    dark: '#3E3E3E',
    darkLight: '#E1E1E1',
    gray: '#e3e3e3',
    text: '#494949',
    textLight: '#7C7C7C',
    textDark: '#1D1D1D',
    rose: '#ef4444',
    roseLight: '#f87171',
    border: '#E1E1E1',
    error: '#ef4444',
    success: '#10b981',
    warning: '#f59e0b',
    background: '#FFFFFF',
    backgroundSecondary: '#F8F9FA',
  },
  fonts: {
    medium: '500',
    semibold: '600',
    bold: '700',
    extraBold: '800',
  },
  radius: {
    xs: 10,
    sm: 12,
    md: 14,
    lg: 16,
    xl: 18,
    xxl: 22,
  },
  input: {
    height: 48,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    borderWidth: 1,
    borderRadius: 12,
    default: {
      borderColor: '#E1E1E1',
      backgroundColor: '#FFFFFF',
      color: '#494949',
    },
    focused: {
      borderColor: '#00C26F',
      backgroundColor: '#FFFFFF',
      color: '#494949',
    },
    error: {
      borderColor: '#ef4444',
      backgroundColor: '#FFFFFF',
      color: '#494949',
    },
    disabled: {
      borderColor: '#E1E1E1',
      backgroundColor: '#F8F9FA',
      color: '#7C7C7C',
    },
    placeholder: '#7C7C7C',
  },
  typography: {
    h1: {
      fontSize: 32,
      fontWeight: '700',
      lineHeight: 40,
    },
    h2: {
      fontSize: 28,
      fontWeight: '600',
      lineHeight: 36,
    },
    h3: {
      fontSize: 24,
      fontWeight: '600',
      lineHeight: 32,
    },
    h4: {
      fontSize: 20,
      fontWeight: '600',
      lineHeight: 28,
    },
    body: {
      fontSize: 16,
      fontWeight: '400',
      lineHeight: 24,
    },
    bodySmall: {
      fontSize: 14,
      fontWeight: '400',
      lineHeight: 20,
    },
    caption: {
      fontSize: 12,
      fontWeight: '400',
      lineHeight: 16,
    },
  },
  shadows: {
    small: {
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 1,
      },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 1,
    },
    medium: {
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    large: {
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 4,
      },
      shadowOpacity: 0.15,
      shadowRadius: 8,
      elevation: 6,
    },
  },
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export default {
  theme,
  spacing,
};