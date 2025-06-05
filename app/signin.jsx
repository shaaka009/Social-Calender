import { router } from "expo-router";
import React, { useState } from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import LoadingState from "../components/LoadingState";
import ScreenWrapper from "../components/ScreenWrapper";
import { theme } from "../constants/theme";
import { wp } from "../helpers/common";
import useLoading from "../helpers/useLoading";

const SignIn = () => {
  const { isLoading, withLoading } = useLoading();
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
        // TODO: Implement actual signin logic here
        await new Promise((resolve) => setTimeout(resolve, 1000));
        router.push("/");
      } catch (err) {
        setError("Invalid email or password");
      }
    });
  };

  return (
    <LoadingState isLoading={isLoading}>
      <ScreenWrapper bg="white">
        <View style={styles.container}>
          <View style={styles.content}>
            <Text style={styles.title}>Welcome Back</Text>
            <Text style={styles.description}>
              Sign in to continue managing your calendar
            </Text>

            <View style={styles.form}>
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Email</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Email"
                  placeholderTextColor={theme.colors.textLight + "90"}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Password</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Password"
                  placeholderTextColor={theme.colors.textLight + "90"}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                />
              </View>

              {error ? <Text style={styles.errorText}>{error}</Text> : null}

              <TouchableOpacity style={styles.button} onPress={handleSignIn}>
                <Text style={styles.buttonText}>Sign In</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.bottomContainer}>
            <TouchableOpacity onPress={() => router.push("signup")}>
              <Text style={styles.linkText}>
                Don't have an account? Sign Up
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScreenWrapper>
    </LoadingState>
  );
};

const baseStyles = StyleSheet.create({
  container: {
    flex: 1,
  },
  text: {
    fontSize: 14,
    textAlign: "center",
  },
  button: {
    borderRadius: wp(2),
    paddingHorizontal: wp(4),
    paddingVertical: wp(2),
    alignItems: "center",
    width: "100%",
  },
});

const styles = StyleSheet.create({
  container: {
    ...baseStyles.container,
    backgroundColor: "white",
  },
  content: {
    ...baseStyles.container,
    paddingHorizontal: wp(4),
    paddingTop: wp(8),
  },
  title: {
    ...baseStyles.text,
    fontSize: 24,
    fontWeight: "600",
    color: theme.colors.textDark,
    marginBottom: wp(2),
  },
  description: {
    ...baseStyles.text,
    fontSize: 16,
    color: theme.colors.textLight,
    marginBottom: wp(8),
  },
  form: {
    gap: wp(4),
  },
  inputContainer: {
    gap: wp(2),
  },
  label: {
    fontSize: 14,
    fontWeight: "500",
    color: theme.colors.textDark,
  },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.darkLight,
    borderRadius: wp(2),
    padding: wp(3),
    fontSize: 16,
  },
  button: {
    ...baseStyles.button,
    backgroundColor: theme.colors.primary,
    marginTop: wp(4),
  },
  buttonText: {
    ...baseStyles.text,
    color: "white",
    fontWeight: "600",
  },
  errorText: {
    ...baseStyles.text,
    color: theme.colors.rose,
    marginTop: wp(2),
  },
  bottomContainer: {
    paddingHorizontal: wp(4),
    paddingBottom: wp(8),
    alignItems: "center",
  },
  linkText: {
    ...baseStyles.text,
    color: theme.colors.textLight,
  },
});

export default SignIn;
