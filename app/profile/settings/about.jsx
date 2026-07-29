import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";
import * as WebBrowser from "expo-web-browser";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import ScreenWrapper from "../../../components/ScreenWrapper";
import { theme } from "../../../constants/theme";
import { wp } from "../../../helpers/common";

const APP_NAME = Constants.expoConfig?.name ?? "Social Calendar";
const APP_VERSION = Constants.expoConfig?.version ?? "1.0.0";

const LINKS = [
  { label: "Privacy Policy", url: "https://join-social.com/privacy" },
  { label: "Terms of Service", url: "https://join-social.com/terms" },
  { label: "Support", url: "https://join-social.com/support" },
];

const AboutSettingsScreen = () => {
  const openLink = async (url) => {
    try {
      await WebBrowser.openBrowserAsync(url);
    } catch {
      // no-op: opening an external link should never crash the screen
    }
  };

  return (
    <ScreenWrapper>
      <View style={styles.container}>
        <Text style={styles.title}>About</Text>

        <View style={styles.appInfo}>
          <Text style={styles.appName}>{APP_NAME}</Text>
          <Text style={styles.version}>Version {APP_VERSION}</Text>
        </View>

        <View style={styles.linkGroup}>
          {LINKS.map((link) => (
            <TouchableOpacity
              key={link.label}
              style={styles.linkRow}
              onPress={() => openLink(link.url)}
              accessibilityRole="link"
              accessibilityLabel={link.label}
            >
              <Text style={styles.linkText}>{link.label}</Text>
              <Ionicons
                name="open-outline"
                size={wp(5)}
                color={theme.colors.textSecondary}
              />
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.copyright}>
          © {new Date().getFullYear()} {APP_NAME}
        </Text>
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
    marginBottom: wp(4),
  },
  appInfo: {
    marginBottom: wp(6),
  },
  appName: {
    fontSize: wp(5),
    fontWeight: "600",
    color: theme.colors.text,
    marginBottom: wp(1),
  },
  version: {
    fontSize: wp(4),
    color: theme.colors.textSecondary,
  },
  linkGroup: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.backgroundSecondary,
  },
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: wp(4),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.backgroundSecondary,
  },
  linkText: {
    fontSize: wp(4.2),
    color: theme.colors.text,
  },
  copyright: {
    marginTop: wp(8),
    fontSize: wp(3.5),
    color: theme.colors.textLight,
  },
});

export default AboutSettingsScreen;
