import { QueryClient, QueryCache, MutationCache } from "@tanstack/react-query";
import { notifications } from "@mantine/notifications";
import { handleError } from "src/utills/handleError";

const QUERY_ERROR_TITLE = "Data upload error";
const MUTATION_ERROR_TITLE = "Operation error";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },

  queryCache: new QueryCache({
    onError: (error) => {
      const message = handleError(error, { title: QUERY_ERROR_TITLE });

      if (message) {
        notifications.show({
          title: QUERY_ERROR_TITLE,
          message,
          color: "red",
        });
      }
    },
  }),

  mutationCache: new MutationCache({
    onError: (error) => {
      const message = handleError(error, {
        title: MUTATION_ERROR_TITLE,
        silentStatuses: [401],
      });

      if (message) {
        notifications.show({
          title: MUTATION_ERROR_TITLE,
          message,
          color: "red",
        });
      }
    },
  }),
});
