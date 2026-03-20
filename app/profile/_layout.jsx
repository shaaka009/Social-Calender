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
        name="settings/index"
        options={{
          headerShown: false,
          title: "Settings",
        }}
      />
      <Stack.Screen
        name="settings/about"
        options={{
          title: "About",
        }}
      />
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
