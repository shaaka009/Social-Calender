import { useRouter } from "expo-router";
import { useEffect } from "react";
import { Image, StyleSheet, View } from "react-native";
import ScreenWrapper from "../components/ScreenWrapper";
import { isAuthenticated } from "../helpers/auth";
import { theme } from "../constants/theme";
import { hp, wp } from "../helpers/common";

const Index = () => {
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(async () => {
      const loggedIn = await isAuthenticated();
      router.replace(loggedIn ? "/home" : "/welcome");
    }, 2000);

    return () => clearTimeout(timer);
  }, [router]);

  return (
    <ScreenWrapper bg="white">
      <View style={styles.content}>
        <View style={styles.logoContainer}>
          <Image 
            source={require("../assets/images/logo.svg")} 
            style={styles.logo}
            resizeMode="contain"
          />
        </View>
      </View>
    </ScreenWrapper>
  );
};

const styles = StyleSheet.create({
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: wp(8),
  },
  logoContainer: {
    marginBottom: hp(4),
    padding: wp(6),
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: theme.radius.xxl,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  logo: {
    width: wp(20),
    height: wp(20),
  },
});

export default Index;
