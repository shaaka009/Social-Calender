import { router } from "expo-router";
import { Button, StyleSheet, View } from "react-native";
import LoadingState from "../components/LoadingState";
import ScreenWrapper from "../components/ScreenWrapper";
import { theme } from "../constants/theme";
import { wp } from "../helpers/common";
import useLoading from "../helpers/useLoading";

const Welcome = () => {
  const { isLoading, withLoading } = useLoading();

  const handleNavigation = () => {
    withLoading(async () => {
      // Simulate some async work
      await new Promise((resolve) => setTimeout(resolve, 1000));
      router.push("index");
    });
  };

  return (
    <LoadingState isLoading={isLoading}>
      <ScreenWrapper>
        <View style={styles.container}>
          <View style={styles.content} />
          <View style={styles.bottomContainer}>
            <Button title="Welcome" onPress={handleNavigation} />
          </View>
        </View>
      </ScreenWrapper>
    </LoadingState>
  );
};

export default Welcome;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.primary,
  },
  content: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: wp(4),
  },
  bottomContainer: {
    paddingHorizontal: wp(4),
    paddingBottom: wp(8), // Add some bottom padding for better spacing
  },
});
