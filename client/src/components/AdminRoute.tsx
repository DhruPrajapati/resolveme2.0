import { Navigate, Outlet } from "react-router-dom";
import { Role } from "@resolveme/core";
import { useSession } from "../lib/auth-client";

export default function AdminRoute() {
  const { data: session, isPending } = useSession();

  if (isPending) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (session?.user.role !== Role.admin) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
