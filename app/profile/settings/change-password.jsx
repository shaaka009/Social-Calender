import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import CustomButton from "../../../components/CustomButton";
import CustomInput from "../../../components/CustomInput";
import LoadingState from "../../../components/LoadingState";
import ScreenWrapper from "../../../components/ScreenWrapper";
import { theme } from "../../../constants/theme";
import { wp } from "../../../helpers/common";
import { useChangePasswordMutation } from "../../../helpers/useProfile";

const ChangePasswordScreen = () => {
  const router = useRouter();
  const mutation = useChangePasswordMutation();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    setError("");
    if (!currentPassword || !newPassword || !confirmPassword) {
      setError("Please fill in all fields.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("New password and confirmation do not match.");
      return;
    }
    try {
      const result = await mutation.mutateAsync({
        current_password: currentPassword,
        new_password: newPassword,
      });
      Alert.alert("Success", result?.message || "Your password has been updated.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (err) {
      setError(err.message || "Could not update password.");
    }
  };

  return (
    <LoadingState isLoading={mutation.isPending} subtle={true}>
      <ScreenWrapper>
        <View style={styles.container}>
          <Text style={styles.title}>Change Password</Text>
          <Text style={styles.description}>
            Enter your current password, then choose a new one. Use a strong password you do not use elsewhere.
          </Text>

          <CustomInput
            label="Current Password"
            placeholder="Current Password"
            value={currentPassword}
            onChangeText={setCurrentPassword}
            secureTextEntry
          />
          <CustomInput
            label="New Password"
            placeholder="New Password"
            value={newPassword}
            onChangeText={setNewPassword}
            secureTextEntry
          />
          <CustomInput
            label="Confirm New Password"
            placeholder="Confirm New Password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
          />

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <CustomButton title="Update Password" onPress={handleSubmit} />
          <CustomButton
            title="Cancel"
            onPress={() => router.back()}
            style={styles.cancelButton}
            textStyle={styles.cancelText}
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
    color: theme.colors.text,
  },
  description: {
    fontSize: wp(3.8),
    color: theme.colors.textLight,
    lineHeight: wp(5.5),
    marginBottom: wp(1),
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
    color: theme.colors.textLight,
  },
});

export default ChangePasswordScreen;
