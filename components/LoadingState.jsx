import { BlurView } from "expo-blur";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { theme } from "../constants/theme";

const LoadingState = ({
  isLoading,
  text = "Loading...",
  children,
  blur = true,
  subtle = false,
}) => {
  if (!isLoading) return children;

  const LoadingOverlay = () => (
    <View style={[
      styles.loadingOverlay,
      subtle && styles.subtleOverlay
    ]}>
      <ActivityIndicator 
        size={subtle ? "small" : "large"} 
        color={theme.colors.primary} 
      />
      {text && !subtle && <Text style={styles.loadingText}>{text}</Text>}
    </View>
  );

  if (blur && !subtle) {
    return (
      <>
        {children}
        <BlurView intensity={30} style={StyleSheet.absoluteFill}>
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
  subtleOverlay: {
    backgroundColor: "rgba(255, 255, 255, 0.3)",
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: "#000",
  },
});

export default LoadingState;
