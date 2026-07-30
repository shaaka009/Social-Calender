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
    enabled: Boolean(currentUser?.user?.person_id), // Only fetch if we have Person id
  });

  // Count incoming pending requests - compare Person ids (not User ids).
  const pendingCount = React.useMemo(() => {
    const myPersonId = currentUser?.user?.person_id;
    if (!myPersonId) return 0;
    return contacts.filter(c =>
      c.status === 'pending' &&
      c.target?.id === myPersonId
    ).length;
  }, [contacts, currentUser?.user?.person_id]);

  return {
    pendingCount,
  };
};

export default useContactRequests; 