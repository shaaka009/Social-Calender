import React from "react";
import { StyleSheet, Text, View } from "react-native";
import ScreenWrapper from "../../../components/ScreenWrapper";
import { theme } from "../../../constants/theme";
import { wp } from "../../../helpers/common";

const AboutSettingsScreen = () => {
  return (
    <ScreenWrapper>
      <View style={styles.container}>
        <Text style={styles.title}>About</Text>
        <Text style={styles.description}>About section placeholder.</Text>
      </View>
    </ScreenWrapper>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: wp(5),
    paddingTop: wp(4),
  },
  title: {
    fontSize: wp(7),
    fontWeight: "600",
    color: theme.colors.text,
    marginBottom: wp(1.5),
  },
  description: {
    fontSize: wp(4),
    color: theme.colors.textSecondary,
  },
});

export default AboutSettingsScreen;
