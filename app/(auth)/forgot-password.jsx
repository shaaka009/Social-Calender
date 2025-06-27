import { router } from "expo-router";
import React, { useState } from "react";
import {
  Linking,
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
import { wp } from "../../helpers/common";
import useLoading from "../../helpers/useLoading";

const ForgotPassword = () => {
  const { isLoading, withLoading } = useLoading();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [resetLink, setResetLink] = useState("");

  const handleSubmit = () => {
    setError("");
    if (!email) {
      setError("Please enter your email address");
      return;
    }

    withLoading(async () => {
      try {
        const response = await fetch(ENDPOINTS.PASSWORD_RESET, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || "Failed to send reset email");
        }

        setSuccess(true);
        setResetLink(data.reset_link || "");
      } catch (err) {
        setError(err.message || "Something went wrong");
      }
    });
  };

  const handleLinkPress = async (url) => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        console.log("Cannot open URL: " + url);
      }
    } catch (error) {
      console.error("Error opening URL: ", error);
    }
  };

  if (success) {
    return (
      <ScreenWrapper bg="white">
        <View style={styles.container}>
          <View style={styles.content}>
            <Text style={styles.title}>Check Your Email</Text>
            <Text style={styles.description}>
              We've sent password reset instructions to your email address.
              Please check your inbox and follow the link to reset your password.
            </Text>
            {resetLink ? (
              <TouchableOpacity 
                style={styles.linkContainer}
                onPress={() => handleLinkPress(resetLink)}
              >
                <Text style={styles.linkLabel}>Development Reset Link (Tap to Open):</Text>
                <Text style={[styles.resetLink, styles.clickable]} selectable>
                  {resetLink}
                </Text>
              </TouchableOpacity>
            ) : null}
            <CustomButton
              title="Back to Sign In"
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
              Enter your email address and we'll send you instructions to reset your password
            </Text>

            <View style={styles.form}>
              <CustomInput
                label="Email"
                placeholder="Email"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
              />

              {error ? <Text style={styles.errorText}>{error}</Text> : null}

              <CustomButton
                title="Send Reset Link"
                onPress={handleSubmit}
                style={styles.button}
              />
            </View>
          </View>

          <View style={styles.bottomContainer}>
            <CustomButton
              title="Back to Sign In"
              onPress={() => router.push("/(auth)/signin")}
              variant="text"
            />
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
  errorText: {
    color: theme.colors.error,
    fontSize: wp(3.5),
    textAlign: "center",
  },
  linkContainer: {
    backgroundColor: theme.colors.backgroundSecondary,
    padding: wp(4),
    borderRadius: wp(2),
    marginBottom: wp(4),
  },
  linkLabel: {
    fontSize: wp(3.5),
    color: theme.colors.textLight,
    marginBottom: wp(2),
  },
  resetLink: {
    fontSize: wp(3.5),
    color: theme.colors.primary,
  },
  clickable: {
    textDecorationLine: 'underline',
  },
});

export default ForgotPassword; 