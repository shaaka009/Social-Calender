import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from "expo-router";

const queryClient = new QueryClient();

const _layout = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <Stack
        screenOptions={{
          headerShown: false,
        }}
      >
        <Stack.Screen name="welcome" />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
    </QueryClientProvider>
  );
};

export default _layout;
