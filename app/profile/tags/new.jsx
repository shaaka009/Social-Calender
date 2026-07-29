import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import TagFormFields from "../../../components/tags/TagFormFields";
import ScreenWrapper from "../../../components/ScreenWrapper";
import { TAG_COLOR_OPTIONS } from "../../../constants/tagColors";
import { theme } from "../../../constants/theme";
import { wp } from "../../../helpers/common";
import { useOneShot, useSubmitGuard } from "../../../helpers/useSubmitGuard";
import { useCreateTag } from "../../../helpers/useTags";

const NewTagScreen = () => {
  const router = useRouter();
  const createMutation = useCreateTag();
  const { isSubmitting, run } = useSubmitGuard();
  const goOnce = useOneShot();
  const [name, setName] = useState("");
  const [color, setColor] = useState(TAG_COLOR_OPTIONS[0]);

  const handleSave = () => run(async () => {
    if (!name.trim()) return;
    try {
      await createMutation.mutateAsync({ name: name.trim(), color });
      goOnce(() => router.back());
    } catch (e) {
      const detail = e?.data?.name?.[0] || e?.data?.detail || e?.message || "Could not create tag.";
      Alert.alert("Could not create tag", typeof detail === "string" ? detail : "Invalid request.");
    }
  });

  const busy = createMutation.isPending || isSubmitting;

  return (
    <ScreenWrapper>
      <View style={styles.headerRow}>
        <TouchableOpacity style={styles.backButton} onPress={() => goOnce(() => router.back())} disabled={busy} accessibilityLabel="Go back">
          <Ionicons name="chevron-back" size={wp(7)} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>New tag</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
      >
        <Text style={styles.subtitle}>
          Tags help you organize contacts and events. You can reuse the same tags in both places.
        </Text>
        <TagFormFields
          name={name}
          color={color}
          onChangeName={setName}
          onSelectColor={setColor}
          colorOptions={TAG_COLOR_OPTIONS}
        />
        <Pressable
          style={[styles.primaryBtn, (busy || !name.trim()) && styles.btnDisabled]}
          onPress={handleSave}
          disabled={busy || !name.trim()}
        >
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryBtnText}>Create tag</Text>
          )}
        </Pressable>
      </ScrollView>
    </ScreenWrapper>
  );
};

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: wp(4),
    paddingBottom: wp(2),
  },
  backButton: {
    paddingVertical: wp(1),
    paddingHorizontal: wp(1),
    marginRight: wp(1),
  },
  title: {
    flex: 1,
    fontSize: wp(8.5),
    fontWeight: "600",
    color: theme.colors.text,
  },
  headerSpacer: {
    width: wp(8),
  },
  scroll: {
    paddingHorizontal: wp(5),
    paddingBottom: wp(12),
  },
  subtitle: {
    fontSize: wp(3.8),
    color: theme.colors.textLight,
    marginBottom: wp(4),
    lineHeight: wp(5.5),
  },
  primaryBtn: {
    marginTop: wp(6),
    backgroundColor: theme.colors.primary,
    borderRadius: wp(2.5),
    paddingVertical: wp(3.5),
    alignItems: "center",
  },
  btnDisabled: {
    opacity: 0.5,
  },
  primaryBtnText: {
    color: "#fff",
    fontSize: wp(4.2),
    fontWeight: "600",
  },
});

export default NewTagScreen;
