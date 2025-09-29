import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { theme } from "../constants/theme";

const ScreenWrapper = ({ children, bg }) => {
  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: bg ?? theme.colors.background }]}
      edges={["top"]}
    >
      <View style={styles.content}>{children}</View>
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
});

export default ScreenWrapper;
