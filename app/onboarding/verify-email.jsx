import { useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import CustomButton from "../../components/CustomButton";
import CustomInput from "../../components/CustomInput";
import LoadingState from "../../components/LoadingState";
import ScreenWrapper from "../../components/ScreenWrapper";
import { theme } from "../../constants/theme";
import { ENDPOINTS } from "../../helpers/api";
import { storeTokens } from "../../helpers/auth";
import { parseJsonResponse, wp } from "../../helpers/common";
import useLoading from "../../helpers/useLoading";
import { useOneShot } from "../../helpers/useSubmitGuard";

const VerifyEmail = () => {
  const queryClient = useQueryClient();
  const { isLoading, withLoading } = useLoading();
  const goOnce = useOneShot();
  const params = useLocalSearchParams();
  const email = typeof params.email === "string" ? params.email.trim().toLowerCase() : "";
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const handleResend = () => {
    setError("");
    setInfo("");
    if (!email) {
      setError("Missing email. Please return to sign in.");
      return;
    }

    withLoading(async () => {
      try {
        const response = await fetch(ENDPOINTS.RESEND_VERIFICATION_EMAIL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email: email.trim().toLowerCase() }),
        });
        const data = await parseJsonResponse(response);
        if (!response.ok) {
          throw new Error(data.message || "Failed to resend verification email");
        }
        setInfo(data.message || "Verification email sent.");
      } catch (err) {
        setError(err.message || "Failed to resend verification email");
      }
    });
  };

  const handleContinue = () => {
    setError("");
    setInfo("");
    if (!email || !code) {
      setError("Please enter your 6-digit code");
      return;
    }
    if (!/^\d{6}$/.test(code)) {
      setError("Code must be 6 digits");
      return;
    }

    withLoading(async () => {
      try {
        const response = await fetch(ENDPOINTS.VERIFY_EMAIL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: email.trim().toLowerCase(),
            code,
          }),
        });

        const data = await parseJsonResponse(response);
        if (!response.ok) {
          throw new Error(data.message || "Unable to verify code");
        }

        if (!data.tokens?.access || !data.tokens?.refresh) {
          throw new Error(data.message || "Verification succeeded but no tokens were returned");
        }

        await storeTokens(data.tokens);
        queryClient.clear();
        goOnce(() => router.replace("/onboarding/step1"));
      } catch (err) {
        setError(err.message || "Unable to continue");
      }
    });
  };

  return (
    <LoadingState isLoading={isLoading} subtle={true}>
      <ScreenWrapper bg="white">
        <View style={styles.container}>
          <View style={styles.content}>
            <Text style={styles.title}>Verify Your Email</Text>
            <Text style={styles.description}>
              We sent a 6-digit verification code to your login email. Enter it below to continue.
            </Text>

            <View style={styles.form}>
              <CustomInput
                label="Login Email"
                placeholder="Login Email"
                value={email}
                editable={false}
                autoCapitalize="none"
                keyboardType="email-address"
              />
              <CustomInput
                label="6-Digit Code"
                placeholder="123456"
                value={code}
                onChangeText={(value) => setCode(value.replace(/[^0-9]/g, "").slice(0, 6))}
                keyboardType="number-pad"
              />

              {error ? <Text style={styles.errorText}>{error}</Text> : null}
              {info ? <Text style={styles.infoText}>{info}</Text> : null}

              <CustomButton
                title="Verify Code"
                onPress={handleContinue}
                style={styles.button}
                disabled={isLoading}
              />
              <CustomButton
                title="Resend Code"
                onPress={handleResend}
                style={styles.secondaryButton}
                textStyle={styles.secondaryButtonText}
                disabled={isLoading}
              />
            </View>
          </View>

          <View style={styles.bottomContainer}>
            <TouchableOpacity onPress={() => goOnce(() => router.replace("/(auth)/signin"))} disabled={isLoading}>
              <Text style={styles.linkText}>Back to Sign In</Text>
            </TouchableOpacity>
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
    lineHeight: wp(6),
  },
  form: {
    gap: wp(4),
  },
  button: {
    marginTop: wp(2),
  },
  secondaryButton: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  secondaryButtonText: {
    color: theme.colors.primary,
  },
  bottomContainer: {
    alignItems: "center",
    paddingVertical: wp(5),
  },
  linkText: {
    color: theme.colors.primary,
    fontSize: wp(4),
  },
  errorText: {
    color: theme.colors.error,
    fontSize: wp(3.5),
    textAlign: "center",
  },
  infoText: {
    color: theme.colors.success || theme.colors.primary,
    fontSize: wp(3.5),
    textAlign: "center",
  },
});

export default VerifyEmail;
