import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { RootSiblingParent } from 'react-native-root-siblings';

const queryClient = new QueryClient();

export default function Layout() {
  return (
    <QueryClientProvider client={queryClient}>
      <RootSiblingParent>
        <Stack
          screenOptions={{
            headerShown: false,
          }}
        />
      </RootSiblingParent>
    </QueryClientProvider>
  );
}
