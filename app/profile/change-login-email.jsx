import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import CustomButton from "../../components/CustomButton";
import CustomInput from "../../components/CustomInput";
import LoadingState from "../../components/LoadingState";
import ScreenWrapper from "../../components/ScreenWrapper";
import { theme } from "../../constants/theme";
import { wp } from "../../helpers/common";
import useProfile, {
  useRequestLoginEmailChangeMutation,
  useVerifyLoginEmailChangeMutation,
} from "../../helpers/useProfile";

const ChangeLoginEmailScreen = () => {
  const router = useRouter();
  const { data } = useProfile();
  const requestMutation = useRequestLoginEmailChangeMutation();
  const verifyMutation = useVerifyLoginEmailChangeMutation();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newLoginEmail, setNewLoginEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState("request");
  const [error, setError] = useState("");

  const isLoading = requestMutation.isPending || verifyMutation.isPending;

  const handleRequestCode = async () => {
    setError("");
    if (!currentPassword || !newLoginEmail) {
      setError("Please enter your current password and new login email.");
      return;
    }
    try {
      const result = await requestMutation.mutateAsync({
        current_password: currentPassword,
        new_email: newLoginEmail.trim().toLowerCase(),
      });
      Alert.alert("Code Sent", result?.message || "Verification code sent.");
      setStep("verify");
    } catch (err) {
      setError(err.message || "Failed to send verification code.");
    }
  };

  const handleVerifyCode = async () => {
    setError("");
    if (!/^\d{6}$/.test(code)) {
      setError("Please enter a valid 6-digit code.");
      return;
    }
    try {
      const result = await verifyMutation.mutateAsync({ code });
      Alert.alert("Success", result?.message || "Login email updated.");
      router.back();
    } catch (err) {
      setError(err.message || "Failed to verify code.");
    }
  };

  return (
    <LoadingState isLoading={isLoading} subtle={true}>
      <ScreenWrapper bg={theme.colors.background}>
        <View style={styles.container}>
          <Text style={styles.title}>Change Login Email</Text>
          <Text style={styles.subtitle}>
            Your current login email is {data?.login_email || data?.email || "not set"}.
          </Text>

          {step === "request" ? (
            <View style={styles.form}>
              <CustomInput
                label="Current Password"
                value={currentPassword}
                onChangeText={setCurrentPassword}
                secureTextEntry
              />
              <CustomInput
                label="New Login Email"
                value={newLoginEmail}
                onChangeText={setNewLoginEmail}
                autoCapitalize="none"
                keyboardType="email-address"
              />
              {error ? <Text style={styles.errorText}>{error}</Text> : null}
              <CustomButton title="Send Verification Code" onPress={handleRequestCode} />
            </View>
          ) : (
            <View style={styles.form}>
              <CustomInput
                label="6-Digit Code"
                placeholder="123456"
                value={code}
                onChangeText={(value) => setCode(value.replace(/[^0-9]/g, "").slice(0, 6))}
                keyboardType="number-pad"
              />
              {error ? <Text style={styles.errorText}>{error}</Text> : null}
              <CustomButton title="Verify and Update Login Email" onPress={handleVerifyCode} />
              <CustomButton
                title="Resend Code"
                onPress={handleRequestCode}
                style={styles.secondaryButton}
                textStyle={styles.secondaryText}
              />
            </View>
          )}
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
  subtitle: {
    fontSize: wp(3.8),
    color: theme.colors.textSecondary,
    lineHeight: wp(5.5),
  },
  form: {
    gap: wp(3),
  },
  errorText: {
    color: theme.colors.error,
    textAlign: "center",
    fontSize: wp(3.5),
  },
  secondaryButton: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  secondaryText: {
    color: theme.colors.primary,
  },
});

export default ChangeLoginEmailScreen;
