import { useQuery } from '@tanstack/react-query';
import { ENDPOINTS, apiFetch } from './api';

const useContact = (contactId) => {
  return useQuery({
    queryKey: ['contact', contactId],
    queryFn: () => apiFetch(`${ENDPOINTS.CONTACTS}${contactId}/`),
    enabled: Boolean(contactId),
  });
};

export default useContact; 