import React from "react";
import { StyleSheet, Text, TouchableOpacity } from "react-native";
import { theme } from "../constants/theme";
import { wp } from "../helpers/common";

const CustomButton = ({
  title,
  onPress,
  variant = "primary", // primary, secondary, outline, danger, text
  disabled = false,
  style,
  textStyle,
  ...props
}) => {
  const getButtonStyle = () => {
    switch (variant) {
      case "secondary":
        return styles.buttonSecondary;
      case "outline":
        return styles.buttonOutline;
      case "danger":
        return styles.buttonDanger;
      case "text":
        return styles.buttonTextVariant;
      default:
        return styles.buttonPrimary;
    }
  };

  const getTextStyle = () => {
    switch (variant) {
      case "outline":
        return styles.buttonTextOutline;
      case "danger":
        return styles.buttonTextDanger;
      case "text":
        return styles.buttonTextOnly;
      default:
        return styles.buttonText;
    }
  };

  return (
    <TouchableOpacity
      style={[
        styles.button,
        getButtonStyle(),
        disabled && styles.buttonDisabled,
        style,
      ]}
      onPress={onPress}
      disabled={disabled}
      {...props}
    >
      <Text style={[getTextStyle(), disabled && styles.buttonTextDisabled, textStyle]}>
        {title}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    padding: wp(4),
    borderRadius: wp(3),
    alignItems: "center",
    justifyContent: "center",
  },
  buttonPrimary: {
    backgroundColor: theme.colors.primary,
  },
  buttonSecondary: {
    backgroundColor: theme.colors.backgroundSecondary,
  },
  buttonOutline: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  buttonDanger: {
    backgroundColor: theme.colors.danger,
  },
  buttonTextVariant: {
    backgroundColor: "transparent",
  },
  buttonDisabled: {
    backgroundColor: theme.colors.gray,
    opacity: 0.6,
  },
  buttonText: {
    color: "white",
    fontSize: wp(4),
    fontWeight: "600",
  },
  buttonTextOutline: {
    color: theme.colors.primary,
    fontSize: wp(4),
    fontWeight: "600",
  },
  buttonTextDanger: {
    color: "white",
    fontSize: wp(4),
    fontWeight: "600",
  },
  buttonTextOnly: {
    color: theme.colors.primary,
    fontSize: wp(4),
    fontWeight: "600",
  },
  buttonTextDisabled: {
    color: theme.colors.textLight,
  },
});

export default CustomButton; 