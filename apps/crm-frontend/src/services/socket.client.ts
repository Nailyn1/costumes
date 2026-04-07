import type { visitNotificationResponseDto } from "@costumes/shared";
import type { InfiniteData } from "@tanstack/react-query";
import { io, Socket } from "socket.io-client";
import { queryClient } from "src/app/queryClient";
import { useAuthStore } from "src/stores/auth.store";

const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_URL;
interface StatusUpdatePayload {
  notificationId: number;
  status:
    | "pending"
    | "sent"
    | "delivered"
    | "failed"
    | "isConfirmed"
    | "read"
    | "noAccount";
  totalToday: number;
}
export const socket: Socket = io(SOCKET_URL, {
  autoConnect: false,
  transports: ["websocket"],
  auth: (cb) => {
    const token = useAuthStore.getState().accessToken;
    cb({ token });
  },
});

if (useAuthStore.getState().isAuth) {
  socket.connect();
}

useAuthStore.subscribe((state, prevState) => {
  if (state.isAuth && !prevState.isAuth) {
    socket.connect();
  }

  if (!state.isAuth && prevState.isAuth) {
    socket.disconnect();
  }
});

socket.on("notification_status_updated", (payload: StatusUpdatePayload) => {
  queryClient.setQueriesData<InfiniteData<visitNotificationResponseDto>>(
    { queryKey: ["notifications"] },
    (oldData) => {
      if (!oldData) return oldData;

      return {
        ...oldData,
        pages: oldData.pages.map((page) => ({
          ...page,
          items: page.items.map((item) =>
            item.notificationId === payload.notificationId
              ? { ...item, status: payload.status }
              : item,
          ),
          totalToday: payload.totalToday,
        })),
      };
    },
  );
});

socket.on("disconnect", (reason) => {
  if (import.meta.env.DEV) {
    console.warn(`[Socket] Disconnected: ${reason}`);
  }
});

socket.on("connect", () => {
  if (import.meta.env.DEV) {
    console.info(`[Socket] Connected with ID: ${socket.id}`);
  }
});
