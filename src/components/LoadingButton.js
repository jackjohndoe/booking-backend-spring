import React from 'react';
import { TouchableOpacity, Text, ActivityIndicator, StyleSheet, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

/**
 * Reusable button component with built-in loading state
 * Prevents double-clicks and shows processing indicator
 */
export default function LoadingButton({
  onPress,
  title,
  loading = false,
  disabled = false,
  style,
  textStyle,
  icon,
  iconPosition = 'left', // 'left' or 'right'
  variant = 'primary', // 'primary', 'secondary', 'danger', 'success'
  ...props
}) {
  const isDisabled = disabled || loading;

  const getButtonStyle = () => {
    const baseStyle = [styles.button, styles[variant]];
    if (isDisabled) {
      baseStyle.push(styles.disabled);
    }
    if (style) {
      baseStyle.push(style);
    }
    return baseStyle;
  };

  const getTextStyle = () => {
    const baseStyle = [styles.buttonText, styles[`${variant}Text`]];
    if (textStyle) {
      baseStyle.push(textStyle);
    }
    return baseStyle;
  };

  return (
    <TouchableOpacity
      style={getButtonStyle()}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.7}
      {...props}
    >
      <View style={styles.content}>
        {loading && (
          <ActivityIndicator 
            size="small" 
            color={variant === 'primary' ? '#FFFFFF' : '#333'} 
            style={styles.loader}
          />
        )}
        {!loading && icon && iconPosition === 'left' && (
          <MaterialIcons 
            name={icon} 
            size={20} 
            color={variant === 'primary' ? '#FFFFFF' : '#333'} 
            style={styles.icon}
          />
        )}
        <Text style={getTextStyle()}>
          {loading ? 'Processing...' : title}
        </Text>
        {!loading && icon && iconPosition === 'right' && (
          <MaterialIcons 
            name={icon} 
            size={20} 
            color={variant === 'primary' ? '#FFFFFF' : '#333'} 
            style={styles.icon}
          />
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  loader: {
    marginRight: 0,
  },
  icon: {
    marginHorizontal: 0,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  // Variants
  primary: {
    backgroundColor: '#FFD700',
  },
  primaryText: {
    color: '#333',
  },
  secondary: {
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  secondaryText: {
    color: '#333',
  },
  danger: {
    backgroundColor: '#F44336',
  },
  dangerText: {
    color: '#FFFFFF',
  },
  success: {
    backgroundColor: '#4CAF50',
  },
  successText: {
    color: '#FFFFFF',
  },
  disabled: {
    opacity: 0.6,
  },
});


















