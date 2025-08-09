import { useQuery } from '@tanstack/react-query';
import { ENDPOINTS, apiFetch } from './api';

const useConnection = (connectionId) => {
  return useQuery({
    queryKey: ['connection', connectionId],
    queryFn: () => apiFetch(`${ENDPOINTS.CONNECTIONS}${connectionId}/`),
    enabled: Boolean(connectionId),
  });
};

export default useConnection;