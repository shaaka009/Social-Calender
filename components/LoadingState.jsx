import { BlurView } from "expo-blur";
import React from "react";
import { ActivityIndicator, Animated, StyleSheet, Text } from "react-native";
import { theme } from "../constants/theme";

const LoadingState = ({
  isLoading,
  text = "Loading...",
  children,
  blur = true,
  subtle = false,
  delay = 500, // only show loader if loading exceeds this duration (ms)
}) => {
  // Animated value to smoothly transition the overlay's opacity
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const [show, setShow] = React.useState(false);
  const timerRef = React.useRef(null);

  React.useEffect(() => {
    // When loading starts, set a timer to show overlay after `delay` ms
    if (isLoading) {
      timerRef.current = setTimeout(() => {
        // Still loading? Show overlay and fade in
        if (isLoading) {
          setShow(true);
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }).start();
        }
      }, delay);
    } else {
      // Loading finished:
      // Cancel pending timer
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      // Fade out overlay if it is visible
      if (show) {
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start(({ finished }) => {
          if (finished) {
            setShow(false);
          }
        });
      }
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isLoading]);

  const LoadingOverlay = () => (
    <Animated.View
      style={[
        styles.loadingOverlay,
        subtle && styles.subtleOverlay,
        { opacity: fadeAnim },
      ]}
    >
      <ActivityIndicator 
        size={subtle ? "small" : "large"} 
        color={theme.colors.primary} 
      />
      {text && !subtle && <Text style={styles.loadingText}>{text}</Text>}
    </Animated.View>
  );

  return (
    <>
      {children}
      {show && (
        blur && !subtle ? (
          <BlurView intensity={30} style={StyleSheet.absoluteFill}>
            <LoadingOverlay />
          </BlurView>
        ) : (
          <LoadingOverlay />
        )
      )}
    </>
  );
};

const styles = StyleSheet.create({
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0, 0, 0, 0.25)",
  },
  subtleOverlay: {
    backgroundColor: "rgba(0, 0, 0, 0.15)",
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: theme.colors.text,
  },
});

export default LoadingState;
