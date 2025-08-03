import { useQuery } from "@tanstack/react-query";
import { ENDPOINTS, apiFetch } from "./api";

const useContacts = () => {
  return useQuery({
    queryKey: ["connections"],
    queryFn: () => apiFetch(ENDPOINTS.CONNECTIONS),
    staleTime: 0,  // Make it refetch immediately when invalidated
  });
};

export default useContacts;