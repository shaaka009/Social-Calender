import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { router, Stack } from 'expo-router';
import { useEffect } from 'react';
import { RootSiblingParent } from 'react-native-root-siblings';
import { setOnSessionExpired } from '../helpers/api';

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
  useEffect(() => {
    // When a session dies mid-use (refresh token rejected), drop cached data
    // and send the user back to the welcome screen instead of leaving them on
    // an authenticated screen with failing requests.
    setOnSessionExpired(() => {
      queryClient.clear();
      router.replace('/welcome');
    });
    return () => setOnSessionExpired(null);
  }, []);

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
