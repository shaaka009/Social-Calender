import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ENDPOINTS, apiFetch } from "./api";

const fetchProfile = () => apiFetch(ENDPOINTS.PROFILE);

export const useUpdateProfileMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload) => {
      // Handle FormData vs regular objects
      const isFormData = payload instanceof FormData;
      return apiFetch(ENDPOINTS.PROFILE, {
        method: "PATCH",
        body: isFormData ? payload : JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
  });
};

const useProfile = () => {
  return useQuery({
    queryKey: ["profile"],
    queryFn: fetchProfile,
    staleTime: 5 * 60 * 1000, // 5 minutes - profile data doesn't change often
  });
};

export default useProfile;
