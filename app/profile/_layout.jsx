import { Stack } from "expo-router";
import React from "react";
import { theme } from "../../constants/theme";

const ProfileLayout = () => {
  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: theme.colors.background,
        },
        headerTintColor: theme.colors.text,
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen
        name="edit"
        options={{
          title: "Edit Profile",
          presentation: "modal",
        }}
      />
    </Stack>
  );
};

export default ProfileLayout;
