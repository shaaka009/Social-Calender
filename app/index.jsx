import { useRouter } from "expo-router";
import { Button } from "react-native";
import ScreenWrapper from "../components/ScreenWrapper";

const Index = () => {
  const router = useRouter();
  return (
    <ScreenWrapper>
      <Button title="Get Started" onPress={() => router.push("welcome")} />
    </ScreenWrapper>
  );
};

export default Index;
