import { useQuery } from "@tanstack/react-query";
import { ENDPOINTS, apiFetch } from "./api";

const fetchContacts = () => apiFetch(ENDPOINTS.CONTACTS);

const useContacts = () => {
  return useQuery({
    queryKey: ["contacts"],
    queryFn: fetchContacts,
    staleTime: 5 * 60 * 1000,
  });
};

export default useContacts; 