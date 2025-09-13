import { useQuery } from "@tanstack/react-query";
import { ENDPOINTS, apiFetch } from "./api";

const useContacts = () => {
  return useQuery({
    queryKey: ["connections"],
    queryFn: () => apiFetch(ENDPOINTS.CONNECTIONS),
    staleTime: 30000,  // 30 seconds - reasonable for contact data
  });
};

export default useContacts;