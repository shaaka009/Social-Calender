import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import TagFormFields from "../../../components/tags/TagFormFields";
import ScreenWrapper from "../../../components/ScreenWrapper";
import { TAG_COLOR_OPTIONS } from "../../../constants/tagColors";
import { theme } from "../../../constants/theme";
import { wp } from "../../../helpers/common";
import { useOneShot, useSubmitGuard } from "../../../helpers/useSubmitGuard";
import { useDeleteTag, useTags, useUpdateTag } from "../../../helpers/useTags";

const EditTagScreen = () => {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const tagId = useMemo(() => {
    const raw = Array.isArray(id) ? id[0] : id;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }, [id]);

  const { data: tags = [], isLoading } = useTags();
  const tag = useMemo(
    () => tags.find((t) => Number(t.id) === tagId),
    [tags, tagId]
  );

  const [name, setName] = useState("");
  const [color, setColor] = useState(TAG_COLOR_OPTIONS[0]);
  const updateMutation = useUpdateTag();
  const deleteMutation = useDeleteTag();
  const { isSubmitting, run } = useSubmitGuard();
  const goOnce = useOneShot();

  useEffect(() => {
    if (tag) {
      setName(tag.name || "");
      setColor(tag.color || TAG_COLOR_OPTIONS[0]);
    }
  }, [tag]);

  const handleSave = () => run(async () => {
    if (!tagId || !name.trim()) return;
    try {
      await updateMutation.mutateAsync({
        id: tagId,
        name: name.trim(),
        color,
      });
      goOnce(() => router.back());
    } catch (e) {
      const detail = e?.data?.name?.[0] || e?.data?.detail || e?.message || "Could not save tag.";
      Alert.alert("Could not save", typeof detail === "string" ? detail : "Invalid request.");
    }
  });

  const handleDelete = () => {
    if (!tagId) return;
    Alert.alert(
      "Delete tag",
      `"${tag?.name || name}" will be removed from all contacts and events. This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => run(async () => {
            try {
              await deleteMutation.mutateAsync(tagId);
              goOnce(() => router.back());
            } catch (err) {
              Alert.alert("Could not delete", err?.message || "Something went wrong.");
            }
          }),
        },
      ]
    );
  };

  const busy = updateMutation.isPending || deleteMutation.isPending || isSubmitting;

  if (!tagId) {
    return (
      <ScreenWrapper>
        <Text style={styles.missing}>Invalid tag.</Text>
      </ScreenWrapper>
    );
  }

  if (isLoading) {
    return (
      <ScreenWrapper>
        <ActivityIndicator style={{ marginTop: wp(10) }} color={theme.colors.primary} />
      </ScreenWrapper>
    );
  }

  if (!tag) {
    return (
      <ScreenWrapper>
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.backButton} onPress={() => goOnce(() => router.back())}>
            <Ionicons name="chevron-back" size={wp(7)} color={theme.colors.text} />
          </TouchableOpacity>
        </View>
        <Text style={styles.missing}>This tag no longer exists.</Text>
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper>
      <View style={styles.headerRow}>
        <TouchableOpacity style={styles.backButton} onPress={() => goOnce(() => router.back())} disabled={busy} accessibilityLabel="Go back">
          <Ionicons name="chevron-back" size={wp(7)} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Edit tag</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
      >
        <Text style={styles.subtitle}>
          Changes apply everywhere this tag is used—for contacts and events.
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
          {updateMutation.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryBtnText}>Save changes</Text>
          )}
        </Pressable>

        <Pressable style={[styles.deleteBtn, busy && styles.btnDisabled]} onPress={handleDelete} disabled={busy}>
          <Text style={styles.deleteText}>Delete tag</Text>
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
  deleteBtn: {
    marginTop: wp(5),
    paddingVertical: wp(3),
    alignItems: "center",
  },
  deleteText: {
    color: theme.colors.danger,
    fontSize: wp(4.2),
    fontWeight: "600",
  },
  missing: {
    padding: wp(5),
    color: theme.colors.textLight,
    fontSize: wp(4),
  },
});

export default EditTagScreen;
