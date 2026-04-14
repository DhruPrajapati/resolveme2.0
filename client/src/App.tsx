import { createBrowserRouter, RouterProvider } from "react-router-dom";
import Login from "./pages/Login";
import Home from "./pages/Home";
import Users from "./pages/Users";
import ProtectedRoute from "./components/ProtectedRoute";
import AdminRoute from "./components/AdminRoute";
import Layout from "./components/Layout";

const router = createBrowserRouter([
  { path: "/login", element: <Login /> },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <Layout />,
        children: [
          { path: "/", element: <Home /> },
          {
            element: <AdminRoute />,
            children: [{ path: "/user", element: <Users /> }],
          },
        ],
      },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
