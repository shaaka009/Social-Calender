import { KeyboardAvoidingView, Platform, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { theme } from "../constants/theme";

const ScreenWrapper = ({ children, bg, keyboardAvoiding = true, keyboardVerticalOffset = 0 }) => {
  const body = keyboardAvoiding ? (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={keyboardVerticalOffset}
    >
      {children}
    </KeyboardAvoidingView>
  ) : (
    children
  );

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: bg ?? theme.colors.background }]}
      edges={["top"]}
    >
      <View style={styles.content}>{body}</View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
});

export default ScreenWrapper;
