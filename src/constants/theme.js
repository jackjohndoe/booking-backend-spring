// Theme Constants
// Centralized color scheme and styling constants for the entire app

export const COLORS = {
  // Primary Colors
  PRIMARY: '#FFD700',      // Yellow (Gold)
  SECONDARY: '#FFFFFF',    // White
  
  // Background Colors
  BACKGROUND: '#FFFFFF',
  BACKGROUND_LIGHT: '#F5F5F5',
  BACKGROUND_YELLOW: '#FFF9E6',
  
  // Text Colors
  TEXT_PRIMARY: '#333',
  TEXT_SECONDARY: '#666',
  TEXT_LIGHT: '#999',
  TEXT_WHITE: '#FFFFFF',
  
  // Border Colors
  BORDER: '#E0E0E0',
  BORDER_LIGHT: '#E5E5E5',
  
  // Status Colors
  SUCCESS: '#4CAF50',
  ERROR: '#F44336',
  WARNING: '#FF9800',
  INFO: '#2196F3',
  
  // Special Colors
  BLACK: '#000000',
  TRANSPARENT: 'transparent',
  
  // Star/Rating Colors
  STAR_FILLED: '#FFD700',
  STAR_EMPTY: '#E0E0E0',
  
  // Favorite Colors
  FAVORITE_ACTIVE: '#FF0000',
  FAVORITE_INACTIVE: '#FFFFFF',
};

export const SPACING = {
  XS: 4,
  SM: 8,
  MD: 12,
  LG: 16,
  XL: 20,
  XXL: 24,
  XXXL: 32,
  SECTION: 40,
};

export const BORDER_RADIUS = {
  SM: 8,
  MD: 12,
  LG: 16,
  XL: 20,
  ROUND: 30,
  CIRCLE: 50,
};

export const FONT_SIZES = {
  XS: 12,
  SM: 14,
  MD: 16,
  LG: 18,
  XL: 20,
  XXL: 24,
  XXXL: 36,
  TITLE: 42,
};

export const FONT_WEIGHTS = {
  NORMAL: '400',
  MEDIUM: '500',
  SEMIBOLD: '600',
  BOLD: '700',
};

export const SHADOWS = {
  SMALL: {
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  MEDIUM: {
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8,
  },
  LARGE: {
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 12,
  },
};

// App-wide constants
export const APP_CONFIG = {
  CURRENCY: '₦',
  CURRENCY_NAME: 'Nigerian Naira',
  APP_NAME: 'Nigerian Apartments',
  PACKAGE_NAME: 'com.nigerianapartments.app',
};

// Common button styles
export const BUTTON_STYLES = {
  PRIMARY: {
    backgroundColor: COLORS.PRIMARY,
    paddingVertical: SPACING.LG,
    paddingHorizontal: SPACING.XXL,
    borderRadius: BORDER_RADIUS.MD,
    alignItems: 'center',
    justifyContent: 'center',
  },
  PRIMARY_TEXT: {
    color: COLORS.TEXT_WHITE,
    fontSize: FONT_SIZES.LG,
    fontWeight: FONT_WEIGHTS.BOLD,
  },
  SECONDARY: {
    backgroundColor: COLORS.SECONDARY,
    paddingVertical: SPACING.LG,
    paddingHorizontal: SPACING.XXL,
    borderRadius: BORDER_RADIUS.MD,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.BORDER,
  },
  SECONDARY_TEXT: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: FONT_SIZES.MD,
    fontWeight: FONT_WEIGHTS.SEMIBOLD,
  },
};

// Common input styles
export const INPUT_STYLES = {
  DEFAULT: {
    backgroundColor: COLORS.BACKGROUND_LIGHT,
    borderRadius: BORDER_RADIUS.MD,
    padding: SPACING.LG,
    fontSize: FONT_SIZES.MD,
    color: COLORS.TEXT_PRIMARY,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
  },
};

// Common card styles
export const CARD_STYLES = {
  DEFAULT: {
    backgroundColor: COLORS.BACKGROUND,
    borderRadius: BORDER_RADIUS.MD,
    padding: SPACING.LG,
    marginBottom: SPACING.MD,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
  },
  SHADOW: {
    backgroundColor: COLORS.BACKGROUND,
    borderRadius: BORDER_RADIUS.MD,
    padding: SPACING.LG,
    marginBottom: SPACING.MD,
    ...SHADOWS.SMALL,
  },
};

export default {
  COLORS,
  SPACING,
  BORDER_RADIUS,
  FONT_SIZES,
  FONT_WEIGHTS,
  SHADOWS,
  APP_CONFIG,
  BUTTON_STYLES,
  INPUT_STYLES,
  CARD_STYLES,
};























