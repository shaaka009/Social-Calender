import { router } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
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
  const [devEmailNote, setDevEmailNote] = useState("");

  const handleSubmit = () => {
    setError("");
    setDevEmailNote("");
    if (!email) {
      setError("Please enter your email address");
      return;
    }

    withLoading(async () => {
      try {
        const normalized = email.trim().toLowerCase();
        const response = await fetch(ENDPOINTS.PASSWORD_RESET, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email: normalized }),
        });

        const raw = await response.text();
        let data = {};
        try {
          data = raw ? JSON.parse(raw) : {};
        } catch {
          throw new Error("Unexpected server response. Please try again.");
        }

        if (!response.ok) {
          throw new Error(data.message || "Failed to send reset email");
        }

        setSuccess(true);
        setResetLink(data.reset_link || "");
        if (data.email_error) {
          setDevEmailNote(
            "Email could not be sent (check server logs or SMTP settings). Use the development link below if one appears."
          );
        }
      } catch (err) {
        const msg = err?.message || "Something went wrong";
        if (
          msg === "Network request failed" ||
          msg.toLowerCase().includes("network") ||
          msg.toLowerCase().includes("failed to fetch")
        ) {
          setError("Could not reach the server. Please try again in a moment.");
        } else {
          setError(msg);
        }
      }
    });
  };

  const openDevResetInApp = (url) => {
    try {
      const parsed = new URL(url);

      // Custom scheme: socialcalendar://reset-password/<uid>/<token>
      if (
        parsed.protocol === "socialcalendar:" &&
        parsed.hostname === "reset-password"
      ) {
        const segs = parsed.pathname.replace(/^\//, "").split("/").filter(Boolean);
        if (segs.length < 2) return false;
        const uid = decodeURIComponent(segs[0]);
        const token = decodeURIComponent(segs.slice(1).join("/"));
        if (!uid || !token) return false;
        router.push({
          pathname: "/reset-password/[uid]/[token]",
          params: { uid, token },
        });
        return true;
      }

      // Hosted web reset: https://join-social.com/reset.html?uid=&token=
      // (and /reset after Cloudflare html handling). Open in the system browser.
      const isWebReset =
        /^https?:$/i.test(parsed.protocol) &&
        (/\/reset\.html$/i.test(parsed.pathname) ||
          /\/reset\/?$/i.test(parsed.pathname)) &&
        parsed.searchParams.get("uid") &&
        parsed.searchParams.get("token");
      if (isWebReset) {
        Linking.openURL(url);
        return true;
      }

      return false;
    } catch {
      return false;
    }
  };

  const handleLinkPress = async (url) => {
    if (!url) return;
    if (openDevResetInApp(url)) return;

    try {
      let can = false;
      try {
        can = await Linking.canOpenURL(url);
      } catch {
        can = false;
      }
      const isAppScheme = /^socialcalendar:\/\//i.test(url);
      if (can || isAppScheme) {
        await Linking.openURL(url);
        return;
      }
      if (__DEV__) {
        Alert.alert(
          "Could not open link",
          Platform.OS === "ios"
            ? "This device did not allow opening that URL. Rebuild the app after adding the scheme to LSApplicationQueriesSchemes, or paste the link into Safari."
            : "This device did not allow opening that URL."
        );
      }
    } catch (error) {
      if (__DEV__) {
        Alert.alert("Could not open link", error?.message ?? String(error));
      }
    }
  };

  if (success) {
    return (
      <ScreenWrapper bg="white">
        <View style={styles.container}>
          <View style={styles.content}>
            <Text style={styles.title}>Check Your Email</Text>
            <Text style={styles.description}>
              We&apos;ve sent password reset instructions to your email address.
              Please check your inbox and follow the link to reset your password.
            </Text>
            {devEmailNote ? (
              <Text style={[styles.description, styles.devNote]}>{devEmailNote}</Text>
            ) : null}
            {resetLink ? (
              <Pressable
                style={({ pressed }) => [
                  styles.linkContainer,
                  pressed && styles.linkContainerPressed,
                ]}
                onPress={() => handleLinkPress(resetLink)}
              >
                <Text style={styles.linkLabel}>Open in app (development, tap anywhere in this box):</Text>
                {/* Do not use selectable here — it captures touches and blocks the Pressable on iOS/Android. */}
                <Text style={[styles.resetLink, styles.clickable]}>{resetLink}</Text>
              </Pressable>
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
              Enter your email address and we&apos;ll send you instructions to reset your password
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
                disabled={isLoading}
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
  devNote: {
    color: theme.colors.warning,
    marginBottom: wp(2),
  },
  linkContainer: {
    backgroundColor: theme.colors.backgroundSecondary,
    padding: wp(4),
    borderRadius: wp(2),
    marginBottom: wp(4),
  },
  linkContainerPressed: {
    opacity: 0.85,
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