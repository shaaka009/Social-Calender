import { BlurView } from "expo-blur";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { theme } from "../constants/theme";

const LoadingState = ({
  isLoading,
  text = "Loading...",
  children,
  blur = true,
}) => {
  if (!isLoading) return children;

  const LoadingOverlay = () => (
    <View style={styles.loadingOverlay}>
      <ActivityIndicator size="large" color={theme.colors.primary} />
      {text && <Text style={styles.loadingText}>{text}</Text>}
    </View>
  );

  if (blur) {
    return (
      <>
        {children}
        <BlurView intensity={50} style={StyleSheet.absoluteFill}>
          <LoadingOverlay />
        </BlurView>
      </>
    );
  }

  return (
    <>
      {children}
      <LoadingOverlay />
    </>
  );
};

const styles = StyleSheet.create({
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.7)",
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: "#000",
  },
});

export default LoadingState;
