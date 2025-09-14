import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ENDPOINTS, apiFetch } from "./api";

export const useTags = () => {
  return useQuery({
    queryKey: ["tags"],
    queryFn: () => apiFetch(ENDPOINTS.TAGS),
    staleTime: 30000,
  });
};

export const useCreateTag = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (tag) =>
      apiFetch(ENDPOINTS.TAGS, {
        method: "POST",
        body: JSON.stringify(tag),
      }),
    onSuccess: () => queryClient.invalidateQueries(["tags"]),
  });
};
