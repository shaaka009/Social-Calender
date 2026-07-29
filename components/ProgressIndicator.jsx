import React from "react";
import { StyleSheet, View } from "react-native";
import { theme } from "../constants/theme";
import { wp } from "../helpers/common";

const ProgressIndicator = ({ totalSteps, currentStep }) => {
  return (
    <View style={styles.container}>
      {Array.from({ length: totalSteps }, (_, index) => (
        <View
          key={index}
          style={[
            styles.step,
            index < currentStep ? styles.completed : styles.inactive,
            index === currentStep - 1 ? styles.active : null,
          ]}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: wp(2),
    paddingVertical: wp(4),
  },
  step: {
    height: wp(2),
    flex: 1,
    borderRadius: wp(1),
    backgroundColor: theme.colors.border,
  },
  active: {
    backgroundColor: theme.colors.primary,
  },
  completed: {
    backgroundColor: theme.colors.primary,
    opacity: 0.5,
  },
  inactive: {
    backgroundColor: theme.colors.border,
  },
});

export default ProgressIndicator;

