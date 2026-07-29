import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import CustomButton from "../../../components/CustomButton";
import CustomInput from "../../../components/CustomInput";
import LoadingState from "../../../components/LoadingState";
import ScreenWrapper from "../../../components/ScreenWrapper";
import { theme } from "../../../constants/theme";
import { ENDPOINTS, apiFetch } from "../../../helpers/api";
import { clearTokens } from "../../../helpers/auth";
import { wp } from "../../../helpers/common";
import { useOneShot, useSubmitGuard } from "../../../helpers/useSubmitGuard";

const DeleteAccountScreen = () => {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { isSubmitting, run } = useSubmitGuard();
  const goOnce = useOneShot();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleDelete = () => run(async () => {
    setError("");
    if (!password) {
      setError("Please enter your password.");
      return;
    }

    try {
      await apiFetch(ENDPOINTS.DELETE_ACCOUNT, {
        method: "DELETE",
        body: JSON.stringify({ password }),
      });
      await clearTokens();
      queryClient.clear();
      goOnce(() => router.replace("/welcome"));
    } catch (err) {
      setError(err.message || "Failed to delete account.");
    }
  });

  return (
    <LoadingState isLoading={isSubmitting} subtle={true}>
      <ScreenWrapper>
        <View style={styles.container}>
          <Text style={styles.title}>Delete Account</Text>
          <Text style={styles.description}>
            This will permanently delete your account and all data. Enter your password to confirm.
          </Text>

          <CustomInput
            label="Password"
            placeholder="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <CustomButton title="Delete Account" onPress={handleDelete} disabled={isSubmitting} />
          <CustomButton
            title="Cancel"
            onPress={() => goOnce(() => router.back())}
            style={styles.cancelButton}
            textStyle={styles.cancelText}
            disabled={isSubmitting}
          />
        </View>
      </ScreenWrapper>
    </LoadingState>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: wp(5),
    gap: wp(4),
  },
  title: {
    fontSize: wp(7),
    fontWeight: "700",
    color: theme.colors.error,
  },
  description: {
    fontSize: wp(3.8),
    color: theme.colors.textSecondary,
    lineHeight: wp(5.5),
  },
  errorText: {
    color: theme.colors.error,
    fontSize: wp(3.5),
  },
  cancelButton: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  cancelText: {
    color: theme.colors.textSecondary,
  },
});

export default DeleteAccountScreen;
