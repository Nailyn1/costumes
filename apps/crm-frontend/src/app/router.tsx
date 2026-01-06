import { createBrowserRouter, Navigate } from "react-router-dom";
import { LoginPage } from "src/pages/LoginPage";
import { BookingsPage } from "src/pages/BookingsPage";
import { CreateBookingPage } from "src/pages/CreateBookingPage";
import { ProfilePage } from "src/pages/ProfilePage";
import { PrivateRoute } from "./providers/PrivateRoute";

export const router = createBrowserRouter([
  {
    path: "/login",
    element: <LoginPage />,
  },
  {
    path: "/",
    element: <PrivateRoute />,
    children: [
      {
        index: true,
        element: <Navigate to="/bookings" replace />,
      },
      {
        path: "bookings",
        children: [
          {
            index: true,
            element: <CreateBookingPage />,
          },
          {
            path: "all",
            element: <BookingsPage />,
          },
        ],
      },
      {
        path: "profile",
        element: <ProfilePage />,
      },
    ],
  },

  {
    path: "*",
    element: <Navigate to="/" replace />,
  },
]);
