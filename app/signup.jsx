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

        router.push("/");
      } catch (err) {
        console.error("Signup error:", err);
        setError("Network error or server is not responding");
      }
    });
  };

  return (
    <LoadingState isLoading={isLoading}>
      <ScreenWrapper bg="white">
        <View style={styles.container}>
          <View style={styles.content}>
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.description}>
              Enter your details below to create your account
            </Text>

            <View style={styles.form}>
              <View style={styles.inputContainer}>
                <Text style={styles.label}>First Name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="First Name"
                  placeholderTextColor={theme.colors.textLight + "90"}
                  value={firstName}
                  onChangeText={setFirstName}
                  autoCapitalize="words"
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Last Name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Last Name"
                  placeholderTextColor={theme.colors.textLight + "90"}
                  value={lastName}
                  onChangeText={setLastName}
                  autoCapitalize="words"
                />
              </View>

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

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Confirm Password</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Confirm Password"
                  placeholderTextColor={theme.colors.textLight + "90"}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry
                />
              </View>

              {error ? <Text style={styles.errorText}>{error}</Text> : null}

              <TouchableOpacity style={styles.button} onPress={handleSignUp}>
                <Text style={styles.buttonText}>Create Account</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.bottomContainer}>
            <TouchableOpacity onPress={() => router.push("signin")}>
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

export default SignUp;
