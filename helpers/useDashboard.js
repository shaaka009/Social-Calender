import { useQuery } from "@tanstack/react-query";
import { ENDPOINTS, apiFetch } from "./api";

const fetchDashboard = () => apiFetch(ENDPOINTS.DASHBOARD);

const useDashboard = () => {
  return useQuery({
    queryKey: ["dashboard"],
    queryFn: fetchDashboard,
    staleTime: 15 * 60 * 1000, // 15 minutes
    retry: 1,
  });
};

export default useDashboard; 