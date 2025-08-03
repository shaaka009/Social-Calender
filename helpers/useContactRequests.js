import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ENDPOINTS, apiFetch } from './api';

const useContactRequests = () => {
  const queryClient = useQueryClient();
  // Get current user data
  const { data: currentUser } = useQuery({
    queryKey: ['user'],
    queryFn: () => apiFetch(ENDPOINTS.USER),
  });

  const { data: contacts = [] } = useQuery({
    queryKey: ['connections'],
    queryFn: () => apiFetch(ENDPOINTS.CONNECTIONS),
    staleTime: 30000, // Re-fetch after 30 seconds
  });

  console.log('useContactRequests - Current user:', currentUser);
  console.log('useContactRequests - All contacts:', contacts);

  // Count incoming pending requests
  const pendingCount = contacts.filter(c => 
    c.status === 'pending' &&
    c.target.id === currentUser?.user?.id // Request addressed to me
  ).length;

  console.log('useContactRequests - Pending count:', pendingCount);

  return {
    pendingCount,
  };
};

export default useContactRequests; 