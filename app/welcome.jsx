import { Image } from "expo-image";
import { router } from "expo-router";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import CustomButton from "../components/CustomButton";
import ScreenWrapper from "../components/ScreenWrapper";
import { theme } from "../constants/theme";
import { wp } from "../helpers/common";

const Welcome = () => {
  const handleNavigation = (page) => {
    router.push(page);
  };

  return (
    <ScreenWrapper bg="white">
        <View style={styles.container}>
          <View style={styles.inner}>
            <View style={styles.textContainer}>
              <Text style={styles.title}>
                Welcome to
              </Text>
              <Image
              source={require("../assets/images/logo.svg")}
              style={styles.image}
              contentFit="contain"
              />
              <Text style={styles.description}>
                <Text style={styles.boldText}>Sign in to your account</Text>
                {" or "}
                <Text style={styles.boldText}>create a new one</Text>
                {" to get started with managing your calendar."}
              </Text>
            </View>
            <View style={styles.actions}>
              <CustomButton
                title="Sign Up"
                onPress={() => handleNavigation("/onboarding/signup")}
                style={styles.button}
              />
              <TouchableOpacity onPress={() => handleNavigation("/(auth)/signin")}>
                <Text style={styles.linkText}>
                  Already have an account? Sign In
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScreenWrapper>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    padding: wp(5),
  },
  inner: {
    alignItems: "center",
    width: "100%",
  },
  actions: {
    alignItems: "center",
    alignSelf: "stretch",
    marginTop: wp(30),
    gap: wp(5),
  },
  button: {
    width: "100%",
  },
  linkText: {
    color: theme.colors.primary,
    fontSize: wp(4),
  },
  textContainer: {
    alignItems: "center",
    paddingHorizontal: wp(4),
  },
  title: {
    fontSize: wp(7),
    fontWeight: "bold",
    color: theme.colors.text,
    textAlign: "center",
  },
  description: {
    fontSize: wp(4),
    color: theme.colors.textLight,
    lineHeight: wp(6),
    textAlign: "center",
  },
  boldText: {
    fontWeight: "600",
    color: theme.colors.text,
  },
  purpleText: {
    color: theme.colors.primary,
  },
  image: {
    width: wp(40),
    height: wp(30),
    marginBottom: wp(0),
    marginTop: wp(0),
  },
});

export default Welcome;
