import { Image } from "expo-image";
import { router } from "expo-router";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import LoadingState from "../components/LoadingState";
import ScreenWrapper from "../components/ScreenWrapper";
import { theme } from "../constants/theme";
import { wp } from "../helpers/common";
import useLoading from "../helpers/useLoading";

const Welcome = () => {
  const { isLoading, withLoading } = useLoading();

  const handleNavigation = (page) => {
    withLoading(async () => {
      // Simulate some async work
      await new Promise((resolve) => setTimeout(resolve, 1000));
      router.push(page);
    });
  };

  return (
    <LoadingState isLoading={isLoading}>
      <ScreenWrapper bg="white">
        <View style={styles.container}>
          <View style={styles.content}>
            <Image
              source={require("../assets/images/react-logo.png")}
              style={styles.image}
              contentFit="contain"
            />
            <View style={styles.textContainer}>
              <Text style={styles.title}>Welcome to KITcal</Text>
              <Text style={styles.description}>
                <Text style={styles.boldText}>Sign in to your account</Text>
                {" or "}
                <Text style={styles.boldText}>create a new one</Text>
                {" to get started with managing your calendar."}
              </Text>
            </View>
          </View>
          <View style={styles.bottomContainer}>
            <TouchableOpacity
              style={styles.Button}
              onPress={() => handleNavigation("signup")}
            >
              <Text style={styles.buttonText}>Sign Up</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => handleNavigation("signin")}>
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

export default Welcome;

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
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: wp(4),
  },
  bottomContainer: {
    paddingHorizontal: wp(4),
    paddingBottom: wp(8),
    alignItems: "center",
    gap: wp(2),
  },
  Button: {
    ...baseStyles.button,
    borderWidth: 2,
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primary,
  },
  buttonText: {
    ...baseStyles.text,
    color: "white",
    fontWeight: "600",
  },
  linkText: {
    ...baseStyles.text,
    color: theme.colors.textLight,
  },
  textContainer: {
    alignItems: "center",
    paddingHorizontal: wp(4),
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
    lineHeight: 24,
  },
  boldText: {
    fontWeight: "600",
    color: theme.colors.textDark,
  },
  image: {
    width: wp(20),
    height: wp(20),
    marginBottom: wp(6),
  },
});
