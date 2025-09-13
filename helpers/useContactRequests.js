import { useQuery } from '@tanstack/react-query';
import React from 'react';
import { ENDPOINTS, apiFetch } from './api';

const useContactRequests = () => {
  // Get current user data
  const { data: currentUser } = useQuery({
    queryKey: ['user'],
    queryFn: () => apiFetch(ENDPOINTS.USER),
    staleTime: 5 * 60 * 1000, // 5 minutes - user data doesn't change often
  });

  const { data: contacts = [] } = useQuery({
    queryKey: ['connections'],
    queryFn: () => apiFetch(ENDPOINTS.CONNECTIONS),
    staleTime: 30000, // Re-fetch after 30 seconds
    enabled: Boolean(currentUser?.user?.id), // Only fetch if we have user data
  });

  // Count incoming pending requests - use useMemo to avoid recalculating
  const pendingCount = React.useMemo(() => {
    if (!currentUser?.user?.id) return 0;
    return contacts.filter(c => 
      c.status === 'pending' &&
      c.target.id === currentUser.user.id // Request addressed to me
    ).length;
  }, [contacts, currentUser?.user?.id]);

  return {
    pendingCount,
  };
};

export default useContactRequests; 