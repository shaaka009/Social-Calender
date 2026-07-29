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
        name="settings/account"
        options={{
          title: "Account",
        }}
      />
      <Stack.Screen
        name="settings/delete-account"
        options={{
          title: "Delete Account",
          presentation: "modal",
        }}
      />
      <Stack.Screen
        name="settings/change-password"
        options={{
          title: "Change Password",
        }}
      />
      <Stack.Screen
        name="edit"
        options={{
          title: "Edit Profile",
          presentation: "modal",
        }}
      />
      <Stack.Screen
        name="change-login-email"
        options={{
          title: "Change Login Email",
          presentation: "modal",
        }}
      />
      <Stack.Screen
        name="tags"
        options={{
          headerShown: false,
        }}
      />
    </Stack>
  );
};

export default ProfileLayout;
