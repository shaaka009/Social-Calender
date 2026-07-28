import { router, useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import {
  StyleSheet,
  Text,
  View,
} from "react-native";
import CustomButton from "../../../components/CustomButton";
import CustomInput from "../../../components/CustomInput";
import LoadingState from "../../../components/LoadingState";
import ScreenWrapper from "../../../components/ScreenWrapper";
import { theme } from "../../../constants/theme";
import { ENDPOINTS } from "../../../helpers/api";
import { wp } from "../../../helpers/common";
import useLoading from "../../../helpers/useLoading";

function firstParam(value) {
  if (value == null) return '';
  return Array.isArray(value) ? value[0] : value;
}

const ResetPassword = () => {
  const { isLoading, withLoading } = useLoading();
  const params = useLocalSearchParams();
  const uid = firstParam(params.uid);
  const token = firstParam(params.token);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = () => {
    setError("");
    if (!uid || !token) {
      setError("This reset link is missing required information. Request a new link from the sign-in screen.");
      return;
    }
    if (!password || !confirmPassword) {
      setError("Please fill in all fields");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    withLoading(async () => {
      try {
        const response = await fetch(
          ENDPOINTS.PASSWORD_RESET_CONFIRM(uid, token),
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ password }),
          }
        );

        const raw = await response.text();
        let data = {};
        try {
          data = raw ? JSON.parse(raw) : {};
        } catch {
          throw new Error("Unexpected server response. Please try again.");
        }

        if (!response.ok) {
          throw new Error(data.message || "Failed to reset password");
        }

        setSuccess(true);
      } catch (err) {
        setError(err.message || "Something went wrong");
      }
    });
  };

  if (success) {
    return (
      <ScreenWrapper bg="white">
        <View style={styles.container}>
          <View style={styles.content}>
            <Text style={styles.title}>Password Reset Successful</Text>
            <Text style={styles.description}>
              Your password has been reset successfully. You can now sign in with your new password.
            </Text>
            <CustomButton
              title="Sign In"
              onPress={() => router.replace("/(auth)/signin")}
              style={styles.button}
            />
          </View>
        </View>
      </ScreenWrapper>
    );
  }

  return (
    <LoadingState isLoading={isLoading} subtle={true}>
      <ScreenWrapper bg="white">
        <View style={styles.container}>
          <View style={styles.content}>
            <Text style={styles.title}>Reset Password</Text>
            <Text style={styles.description}>
              Enter your new password below
            </Text>

            <View style={styles.form}>
              <CustomInput
                label="New Password"
                placeholder="New Password"
                value={password}
                onChangeText={setPassword}
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

              <CustomButton
                title="Reset Password"
                onPress={handleSubmit}
                style={styles.button}
              />
            </View>
          </View>
        </View>
      </ScreenWrapper>
    </LoadingState>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "space-between",
    padding: wp(5),
  },
  content: {
    flex: 1,
    justifyContent: "center",
  },
  title: {
    fontSize: wp(8),
    fontWeight: "bold",
    color: theme.colors.text,
    marginBottom: wp(2),
  },
  description: {
    fontSize: wp(4),
    color: theme.colors.textLight,
    marginBottom: wp(8),
  },
  form: {
    gap: wp(4),
  },
  button: {
    marginTop: wp(2),
  },
  errorText: {
    color: theme.colors.error,
    fontSize: wp(3.5),
    textAlign: "center",
  },
});

export default ResetPassword; 