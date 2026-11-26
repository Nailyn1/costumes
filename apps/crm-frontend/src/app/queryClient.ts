import { QueryClient, QueryCache, MutationCache } from "@tanstack/react-query";
import { notifications } from "@mantine/notifications";
import { handleError } from "src/utils/handleError";

const QUERY_ERROR_TITLE = "Не удалось загрузить данные";
const MUTATION_ERROR_TITLE = "Не удалось выполнить действие";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },

  queryCache: new QueryCache({
    onError: (error, query) => {
      if (query.meta?.silent) {
        return;
      }

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
    onError: (error, _variables, _context, mutation) => {
      const message = handleError(error, {
        title: MUTATION_ERROR_TITLE,
        silentStatuses: mutation.meta?.showUnauthorized === true ? [] : [401],
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
