import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import ScreenWrapper from "../../../components/ScreenWrapper";
import { theme } from "../../../constants/theme";
import { wp } from "../../../helpers/common";

const ACCOUNT_OPTIONS = [
  {
    key: "change_account_email",
    label: "Change Account Email",
    icon: "mail-outline",
    route: "/profile/change-login-email",
  },
];

const AccountSettingsScreen = () => {
  const router = useRouter();

  return (
    <ScreenWrapper>
      <FlatList
        data={ACCOUNT_OPTIONS}
        keyExtractor={(item) => item.key}
        contentContainerStyle={styles.container}
        ListHeaderComponent={<Text style={styles.sectionTitle}>Account</Text>}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.optionRow} onPress={() => router.push(item.route)}>
            <View style={styles.optionLeft}>
              <Ionicons name={item.icon} size={wp(5.2)} color={theme.colors.text} />
              <Text style={styles.optionText}>{item.label}</Text>
            </View>
            <Ionicons name="chevron-forward" size={wp(5)} color={theme.colors.textLight} />
          </TouchableOpacity>
        )}
      />
    </ScreenWrapper>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: wp(5),
    paddingBottom: wp(8),
  },
  sectionTitle: {
    fontSize: wp(7),
    fontWeight: "600",
    color: theme.colors.text,
    marginBottom: wp(2),
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: wp(4),
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  optionLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: wp(3),
  },
  optionText: {
    fontSize: wp(4.2),
    color: theme.colors.text,
    fontWeight: "500",
  },
});

export default AccountSettingsScreen;
