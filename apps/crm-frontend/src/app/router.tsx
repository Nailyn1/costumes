import { createBrowserRouter, Navigate } from "react-router-dom";
import { LoginPage } from "src/pages/LoginPage";
import { CreateBookingPage } from "src/pages/CreateBooking";
import { IssuePage } from "src/pages/IssuePage";
import { ReturnPage } from "src/pages/ReturnPage";
import { SchedulePage } from "src/pages/SchedulePage";
import { UnrecordedCostumesPage } from "src/pages/UnrecordedCostumes";
import { ProfilePage } from "src/pages/ProfilePage";
import { PrivateRoute } from "./providers/PrivateRoute";
import { MainLayout } from "src/components/MainLayout";

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
        element: <MainLayout />,
        children: [
          {
            index: true,
            element: <Navigate to="/bookings/new" replace />,
          },
          {
            path: "bookings",
            children: [
              {
                path: "new",
                element: <CreateBookingPage />,
              },
              {
                path: "unrecorded",
                element: <UnrecordedCostumesPage />,
              },
              {
                path: "issue",
                element: <IssuePage />,
              },
              {
                path: "return",
                element: <ReturnPage />,
              },
              {
                path: "schedule",
                element: <SchedulePage />,
              },
            ],
          },
          {
            path: "profile",
            element: <ProfilePage />,
          },
        ],
      },
    ],
  },
  {
    path: "*",
    element: <Navigate to="/" replace />,
  },
]);
