import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import CustomButton from "../../components/CustomButton";
import CustomInput from "../../components/CustomInput";
import LoadingState from "../../components/LoadingState";
import ScreenWrapper from "../../components/ScreenWrapper";
import { theme } from "../../constants/theme";
import { ENDPOINTS } from "../../helpers/api";
import { storeTokens } from "../../helpers/auth";
import { wp } from "../../helpers/common";
import useLoading from "../../helpers/useLoading";
import { useOneShot } from "../../helpers/useSubmitGuard";

const SignIn = () => {
  const queryClient = useQueryClient();
  const { isLoading, withLoading } = useLoading();
  const goOnce = useOneShot();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSignIn = () => {
    setError("");
    if (!email || !password) {
      setError("Please fill in all fields");
      return;
    }

    withLoading(async () => {
      try {
        const response = await fetch(ENDPOINTS.SIGN_IN, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email,
            password: password,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          if (data.requires_verification) {
            goOnce(() =>
              router.replace({
                pathname: "/onboarding/verify-email",
                params: { email: email.trim().toLowerCase() },
              })
            );
            return;
          }
          throw new Error(data.message || "Login failed");
        }

        // Store JWT tokens
        await storeTokens(data.tokens);
        queryClient.clear();

        // Login successful
        goOnce(() => router.replace("/home"));
      } catch (err) {
        setError(err.message || "Invalid email or password");
      }
    });
  };

  return (
    <LoadingState isLoading={isLoading} subtle={true}>
      <ScreenWrapper bg="white">
        <View style={styles.container}>
          <View style={styles.content}>
            <Text style={styles.title}>Welcome Back</Text>
            <Text style={styles.description}>
              Sign in to continue managing your calendar
            </Text>

            <View style={styles.form}>
              <CustomInput
                label="Login Email"
                placeholder="Login Email"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
              />

              <CustomInput
                label="Password"
                placeholder="Password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />

              <TouchableOpacity 
                onPress={() => router.push("/(auth)/forgot-password")}
                style={styles.forgotPasswordContainer}
              >
                <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
              </TouchableOpacity>

              {error ? <Text style={styles.errorText}>{error}</Text> : null}

              <CustomButton
                title="Sign In"
                onPress={handleSignIn}
                style={styles.button}
                disabled={isLoading}
              />
            </View>
          </View>

          <View style={styles.bottomContainer}>
            <TouchableOpacity onPress={() => router.push("/onboarding/signup")}>
              <Text style={styles.linkText}>
                Don&apos;t have an account? Sign Up
              </Text>
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
  },
  form: {
    gap: wp(4),
  },
  button: {
    marginTop: wp(2),
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
  forgotPasswordContainer: {
    alignSelf: 'flex-end',
  },
  forgotPasswordText: {
    color: theme.colors.primary,
    fontSize: wp(3.5),
  },
});

export default SignIn;
