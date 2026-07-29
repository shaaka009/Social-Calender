import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import ScreenWrapper from "../../../components/ScreenWrapper";
import { theme } from "../../../constants/theme";
import { wp } from "../../../helpers/common";
import { useTags } from "../../../helpers/useTags";

const TagsListScreen = () => {
  const router = useRouter();
  const { data: tags = [], isLoading } = useTags();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return tags;
    return tags.filter((t) => (t.name || "").toLowerCase().includes(q));
  }, [tags, query]);

  return (
    <ScreenWrapper>
      <View style={styles.headerRow}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()} accessibilityLabel="Go back">
          <Ionicons name="chevron-back" size={wp(7)} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Tags</Text>
        <TouchableOpacity
          style={styles.addHeader}
          onPress={() => router.push("/profile/tags/new")}
          accessibilityLabel="New tag"
        >
          <Ionicons name="add" size={wp(7)} color={theme.colors.primary} />
        </TouchableOpacity>
      </View>

      <TextInput
        style={styles.search}
        placeholder="Search tags..."
        placeholderTextColor={theme.colors.textLight}
        value={query}
        onChangeText={setQuery}
      />

      {isLoading ? (
        <Text style={styles.hint}>Loading...</Text>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <Text style={styles.empty}>{tags.length === 0 ? "No tags yet. Create one with +." : "No matches."}</Text>
          }
          renderItem={({ item }) => (
            <Pressable
              style={styles.row}
              onPress={() => router.push(`/profile/tags/${item.id}`)}
            >
              <View style={styles.rowChipWrap}>
                <View
                  style={[
                    styles.tagChip,
                    {
                      backgroundColor: "transparent",
                      borderColor: item.color || theme.colors.primary,
                    },
                  ]}
                  pointerEvents="none"
                >
                  <Text style={styles.tagChipText} numberOfLines={1}>
                    {` ${item.name} `}
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={wp(5)} color={theme.colors.textLight} />
            </Pressable>
          )}
        />
      )}
    </ScreenWrapper>
  );
};

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: wp(4),
    paddingBottom: wp(2),
    gap: wp(2),
  },
  backButton: {
    paddingVertical: wp(1),
    paddingHorizontal: wp(1),
  },
  title: {
    flex: 1,
    fontSize: wp(8.5),
    fontWeight: "600",
    color: theme.colors.text,
  },
  addHeader: {
    padding: wp(1),
  },
  search: {
    marginHorizontal: wp(5),
    marginBottom: wp(3),
    backgroundColor: theme.colors.backgroundSecondary,
    borderRadius: wp(2.5),
    paddingVertical: wp(2.8),
    paddingHorizontal: wp(3),
    fontSize: wp(4),
    color: theme.colors.text,
  },
  list: {
    paddingHorizontal: wp(5),
    paddingBottom: wp(10),
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: wp(2.5),
    gap: wp(3),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  rowChipWrap: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
  },
  tagChip: {
    alignSelf: "flex-start",
    paddingHorizontal: wp(3),
    paddingVertical: wp(1.5),
    borderRadius: wp(4),
    borderWidth: 1,
    minHeight: wp(8),
    justifyContent: "center",
    maxWidth: "100%",
  },
  tagChipText: {
    color: theme.colors.textLight,
    fontSize: wp(3.5),
  },
  hint: {
    paddingHorizontal: wp(5),
    color: theme.colors.textLight,
  },
  empty: {
    paddingHorizontal: wp(5),
    color: theme.colors.textLight,
    fontSize: wp(4),
  },
});

export default TagsListScreen;
