import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { theme } from "../../constants/theme";
import { TAG_COLOR_OPTIONS } from "../../constants/tagColors";
import { wp } from "../../helpers/common";
import { useSubmitGuard } from "../../helpers/useSubmitGuard";
import { useDeleteTag, useUpdateTag } from "../../helpers/useTags";
import TagFormFields from "./TagFormFields";

/**
 * Compact modal for editing/deleting a tag from tab filter chips (long-press).
 */
const TagEditModal = ({ visible, tag, onClose, onAfterChange }) => {
  const [name, setName] = useState("");
  const [color, setColor] = useState(TAG_COLOR_OPTIONS[0]);
  const updateMutation = useUpdateTag();
  const deleteMutation = useDeleteTag();
  const { isSubmitting, run } = useSubmitGuard();

  const cardScale = useRef(new Animated.Value(1)).current;
  const cardOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (visible && tag) {
      setName(tag.name || "");
      setColor(tag.color || TAG_COLOR_OPTIONS[0]);
      cardScale.setValue(0.88);
      cardOpacity.setValue(0);
      Animated.parallel([
        Animated.spring(cardScale, {
          toValue: 1,
          friction: 8,
          tension: 280,
          useNativeDriver: true,
        }),
        Animated.timing(cardOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, tag]);

  const handleSave = () => run(async () => {
    if (!tag?.id || !name.trim()) return;
    try {
      const data = await updateMutation.mutateAsync({
        id: tag.id,
        name: name.trim(),
        color,
      });
      onAfterChange?.(data);
      onClose();
    } catch (e) {
      const detail = e?.data?.name?.[0] || e?.data?.detail || e?.message || "Could not save tag.";
      Alert.alert("Could not save", typeof detail === "string" ? detail : "Invalid request.");
    }
  });

  const handleDelete = () => {
    if (!tag?.id) return;
    Alert.alert(
      "Delete tag",
      `"${tag.name}" will be removed from all contacts and events. This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => run(async () => {
            try {
              await deleteMutation.mutateAsync(tag.id);
              onAfterChange?.(null);
              onClose();
            } catch (err) {
              Alert.alert("Could not delete", err?.message || "Something went wrong.");
            }
          }),
        },
      ]
    );
  };

  const busy = updateMutation.isPending || deleteMutation.isPending || isSubmitting;

  const cardAnimatedStyle = {
    opacity: cardOpacity,
    transform: [{ scale: cardScale }],
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Animated.View style={[styles.card, cardAnimatedStyle]}>
          <Text style={styles.title}>Edit tag</Text>
          <TagFormFields
            name={name}
            color={color}
            onChangeName={setName}
            onSelectColor={setColor}
            colorOptions={TAG_COLOR_OPTIONS}
          />
          <Pressable
            style={[styles.deleteBtn, busy && styles.btnDisabled]}
            onPress={handleDelete}
            disabled={busy}
          >
            <Text style={styles.deleteText}>Delete tag</Text>
          </Pressable>
          <View style={styles.actions}>
            <Pressable style={styles.actionBtn} onPress={onClose} disabled={busy}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable style={styles.actionBtn} onPress={handleSave} disabled={busy || !name.trim()}>
              {busy ? (
                <ActivityIndicator size="small" color={theme.colors.primary} />
              ) : (
                <Text style={styles.saveText}>Save</Text>
              )}
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
    padding: wp(5),
  },
  card: {
    backgroundColor: theme.colors.background,
    borderRadius: wp(3),
    padding: wp(5),
    width: "100%",
    maxWidth: 400,
  },
  title: {
    fontSize: wp(5),
    fontWeight: "600",
    marginBottom: wp(3),
    color: theme.colors.text,
  },
  deleteBtn: {
    marginTop: wp(4),
    paddingVertical: wp(2),
  },
  btnDisabled: {
    opacity: 0.5,
  },
  deleteText: {
    color: theme.colors.danger,
    fontSize: wp(4),
    fontWeight: "600",
  },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: wp(3),
    marginTop: wp(2),
  },
  actionBtn: {
    paddingHorizontal: wp(3),
    paddingVertical: wp(2),
    minWidth: wp(16),
    alignItems: "center",
  },
  cancelText: {
    color: theme.colors.text,
    fontSize: wp(4),
  },
  saveText: {
    color: theme.colors.primary,
    fontSize: wp(4),
    fontWeight: "600",
  },
});

export default TagEditModal;
