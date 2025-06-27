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
import { wp } from "../../helpers/common";
import useLoading from "../../helpers/useLoading";

const SignUp = () => {
  const { isLoading, withLoading } = useLoading();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");

  const handleSignUp = () => {
    setError("");
    if (!firstName || !lastName || !email || !password || !confirmPassword) {
      setError("Please fill in all fields");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    withLoading(async () => {
      try {
        const response = await fetch("http://localhost:8000/api/signup/", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: email,
            first_name: firstName,
            last_name: lastName,
            password1: password,
            password2: confirmPassword,
          }),
          credentials: "include",
        });

        const data = await response.json();

        if (!response.ok) {
          if (data.errors) {
            const errorMessages = Object.values(data.errors).flat().join(", ");
            setError(errorMessages);
          } else {
            setError("Failed to create account");
          }
          return;
        }

        router.replace("/(auth)/signin");
      } catch (err) {
        console.error("Signup error:", err);
        setError("Network error or server is not responding");
      }
    });
  };

  return (
    <LoadingState isLoading={isLoading} subtle={true}>
      <ScreenWrapper bg="white">
        <View style={styles.container}>
          <View style={styles.content}>
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.description}>
              Enter your details below to create your account
            </Text>

            <View style={styles.form}>
              <CustomInput
                label="First Name"
                placeholder="First Name"
                value={firstName}
                onChangeText={setFirstName}
                autoCapitalize="words"
              />

              <CustomInput
                label="Last Name"
                placeholder="Last Name"
                value={lastName}
                onChangeText={setLastName}
                autoCapitalize="words"
              />

              <CustomInput
                label="Email"
                placeholder="Email"
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

              <CustomInput
                label="Confirm Password"
                placeholder="Confirm Password"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
              />

              {error ? <Text style={styles.errorText}>{error}</Text> : null}

              <CustomButton
                title="Create Account"
                onPress={handleSignUp}
                style={styles.button}
              />
            </View>
          </View>

          <View style={styles.bottomContainer}>
            <TouchableOpacity onPress={() => router.push("/(auth)/signin")}>
              <Text style={styles.linkText}>
                Already have an account? Sign In
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
});

export default SignUp;
