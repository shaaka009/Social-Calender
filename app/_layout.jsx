import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { RootSiblingParent } from 'react-native-root-siblings';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Keep recently fetched screen data warm across quick tab/screen switches.
      staleTime: 60 * 1000,
      gcTime: 10 * 60 * 1000,
      retry: 1,
    },
  },
});

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
