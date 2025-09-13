import React from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { theme } from "../constants/theme";
import { wp } from "../helpers/common";

const CustomInput = ({
  label,
  placeholder,
  value,
  onChangeText,
  secureTextEntry = false,
  autoCapitalize = "none",
  keyboardType = "default",
  error,
  helper,
  ...props
}) => {
  return (
    <View style={styles.inputContainer}>
      {label && <Text style={styles.label}>{label}</Text>}
      <TextInput
        style={[styles.input, error && styles.inputError]}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.textLight + "90"}
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secureTextEntry}
        autoCapitalize={autoCapitalize}
        keyboardType={keyboardType}
        {...props}
      />
      {error && <Text style={styles.errorText}>{error}</Text>}
      {helper && !error && <Text style={styles.helperText}>{helper}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  inputContainer: {
    gap: wp(2),
  },
  label: {
    fontSize: wp(4),
    fontWeight: "500",
    color: theme.colors.text,
  },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: wp(3),
    padding: wp(4),
    fontSize: wp(4),
    color: theme.colors.text,
  },
  inputError: {
    borderColor: theme.colors.error,
  },
  errorText: {
    color: theme.colors.error,
    fontSize: wp(3.5),
  },
  helperText: {
    color: theme.colors.textLight,
    fontSize: wp(3.5),
  },
});

export default CustomInput; 