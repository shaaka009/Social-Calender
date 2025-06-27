import { useRouter } from "expo-router";
import { useEffect } from "react";
import { Image, StyleSheet, View } from "react-native";
import ScreenWrapper from "../components/ScreenWrapper";
import { theme } from "../constants/theme";
import { hp, wp } from "../helpers/common";

const Index = () => {
  const router = useRouter();

  useEffect(() => {
    // Auto-navigate to home after 2 seconds
    const timer = setTimeout(() => {
      router.replace("/welcome");
    }, 2000);

    // Cleanup timer on component unmount
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <ScreenWrapper bg="white">
      <View style={styles.content}>
        <View style={styles.logoContainer}>
          <Image 
            source={require("../assets/images/react-logo.png")} 
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
  title: {
    fontSize: wp(8),
    color: 'white',
    fontWeight: theme.fonts.extraBold,
    textAlign: 'center',
    marginBottom: hp(1),
  },
  subtitle: {
    fontSize: wp(4),
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    fontWeight: theme.fonts.medium,
  },
});

export default Index;
