import { useQuery } from "@tanstack/react-query";
import { ENDPOINTS, apiFetch } from "./api";

const useContacts = (queryOptions = {}) => {
  return useQuery({
    queryKey: ["connections"],
    queryFn: () => apiFetch(ENDPOINTS.CONNECTIONS),
    staleTime: 30 * 1000,
    ...queryOptions,
  });
};

export default useContacts;