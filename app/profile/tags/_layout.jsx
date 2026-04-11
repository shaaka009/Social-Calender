import { Stack } from "expo-router";
import React from "react";
import { theme } from "../../../constants/theme";

const TagsLayout = () => {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.colors.background },
      }}
    />
  );
};

export default TagsLayout;
