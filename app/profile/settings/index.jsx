import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { Alert, FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import ScreenWrapper from "../../../components/ScreenWrapper";
import { theme } from "../../../constants/theme";
import { ENDPOINTS, apiFetch } from "../../../helpers/api";
import { clearTokens } from "../../../helpers/auth";
import { wp } from "../../../helpers/common";

const SETTINGS_OPTIONS = [
  { key: "account", label: "Account", icon: "person-circle-outline", route: "/profile/settings/account" },
  { key: "about", label: "About", icon: "information-circle-outline", route: "/profile/settings/about" },
];

const SettingsScreen = () => {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");

  const filteredOptions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return SETTINGS_OPTIONS;
    return SETTINGS_OPTIONS.filter((option) => option.label.toLowerCase().includes(query));
  }, [searchQuery]);

  const handleSignOut = () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          try {
            await apiFetch(ENDPOINTS.SIGN_OUT, { method: "POST" }).catch(() => {});
          } finally {
            await clearTokens();
            await queryClient.cancelQueries();
            queryClient.clear();
            router.replace("/welcome");
          }
        },
      },
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      "Delete Account",
      "This will permanently delete your account and all data. Continue?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Continue",
          style: "destructive",
          onPress: () => router.push("/profile/settings/delete-account"),
        },
      ]
    );
  };

  return (
    <ScreenWrapper>
      <FlatList
        data={filteredOptions}
        keyExtractor={(item) => item.key}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        ListHeaderComponent={
          <View style={styles.headerBlock}>
            <View style={styles.titleRow}>
              <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                <Ionicons name="chevron-back" size={wp(7)} color={theme.colors.text} />
              </TouchableOpacity>
              <Text style={styles.title}>Settings</Text>
            </View>
            <TextInput
              style={styles.searchInput}
              placeholder="Search settings..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholderTextColor={theme.colors.textLight}
            />
          </View>
        }
        ListEmptyComponent={
          <View style={styles.placeholderSection}>
            <Text style={styles.placeholderTitle}>General</Text>
            <Text style={styles.placeholderText}>First settings section placeholder.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.optionRow} onPress={() => router.push(item.route)}>
            <View style={styles.optionLeft}>
              <Ionicons name={item.icon} size={wp(5.2)} color={theme.colors.text} />
              <Text style={styles.optionText}>{item.label}</Text>
            </View>
            <Ionicons name="chevron-forward" size={wp(5)} color={theme.colors.textLight} />
          </TouchableOpacity>
        )}
        ListFooterComponent={
          <View style={styles.footerActions}>
            <TouchableOpacity style={styles.subtleAction} onPress={handleSignOut}>
              <Ionicons name="log-out-outline" size={wp(4.8)} color={theme.colors.error} />
              <Text style={styles.signOutText}>Sign Out</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.deleteAction} onPress={handleDeleteAccount}>
              <Ionicons name="trash-outline" size={wp(5)} color={theme.colors.error} />
              <Text style={styles.deleteActionText}>Delete Account</Text>
            </TouchableOpacity>
          </View>
        }
      />
    </ScreenWrapper>
  );
};

const styles = StyleSheet.create({
  listContent: {
    paddingHorizontal: wp(5),
    paddingTop: wp(3),
    paddingBottom: wp(8),
  },
  headerBlock: {
    marginBottom: wp(2),
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: wp(3),
    marginLeft: -wp(2),
  },
  backButton: {
    paddingVertical: wp(1),
    paddingHorizontal: wp(1),
    marginRight: wp(1),
  },
  title: {
    fontSize: wp(8.5),
    fontWeight: "600",
    color: theme.colors.text,
  },
  searchInput: {
    backgroundColor: theme.colors.backgroundSecondary,
    borderRadius: wp(2.5),
    paddingVertical: wp(2.8),
    paddingHorizontal: wp(3.2),
    fontSize: wp(4),
    color: theme.colors.text,
    marginBottom: wp(2),
  },
  placeholderSection: {
    borderRadius: wp(3),
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingVertical: wp(4),
    paddingHorizontal: wp(4),
    marginTop: wp(2),
    backgroundColor: theme.colors.card,
  },
  placeholderTitle: {
    fontSize: wp(4.3),
    color: theme.colors.text,
    fontWeight: "600",
    marginBottom: wp(1),
  },
  placeholderText: {
    fontSize: wp(3.6),
    color: theme.colors.textSecondary,
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
  footerActions: {
    marginTop: wp(6),
    paddingTop: wp(2),
    gap: wp(1),
  },
  subtleAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: wp(2.5),
    paddingVertical: wp(3),
  },
  signOutText: {
    fontSize: wp(4),
    color: theme.colors.error,
    fontWeight: "500",
  },
  deleteAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: wp(2.5),
    paddingVertical: wp(3),
  },
  deleteActionText: {
    fontSize: wp(4.2),
    color: theme.colors.error,
    fontWeight: "700",
  },
});

export default SettingsScreen;
