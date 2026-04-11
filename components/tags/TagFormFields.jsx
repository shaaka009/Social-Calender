import React from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { TAG_COLOR_OPTIONS } from "../../constants/tagColors";
import { theme } from "../../constants/theme";
import { wp } from "../../helpers/common";

const TagFormFields = ({
  name,
  color,
  onChangeName,
  onSelectColor,
  colorOptions = TAG_COLOR_OPTIONS,
}) => {
  return (
    <View>
      <Text style={styles.label}>Name</Text>
      <TextInput
        style={styles.input}
        placeholder="Tag name"
        placeholderTextColor={theme.colors.textLight}
        value={name}
        onChangeText={onChangeName}
        autoCapitalize="sentences"
      />
      <Text style={[styles.label, styles.labelSpacing]}>Color</Text>
      <View style={styles.colorsRow}>
        {colorOptions.map((c) => (
          <Pressable
            key={c}
            style={[styles.colorDot, { backgroundColor: c }, color === c && styles.colorDotSelected]}
            onPress={() => onSelectColor(c)}
          />
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  label: {
    fontSize: wp(3.5),
    fontWeight: "600",
    color: theme.colors.textLight,
    marginBottom: wp(1.5),
  },
  labelSpacing: {
    marginTop: wp(2),
  },
  input: {
    backgroundColor: theme.colors.backgroundSecondary,
    borderRadius: wp(2),
    padding: wp(3),
    fontSize: wp(4),
    color: theme.colors.text,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  colorsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: wp(2),
  },
  colorDot: {
    width: wp(8),
    height: wp(8),
    borderRadius: wp(4),
    borderWidth: 2,
    borderColor: "transparent",
  },
  colorDotSelected: {
    borderColor: theme.colors.text,
  },
});

export default TagFormFields;
