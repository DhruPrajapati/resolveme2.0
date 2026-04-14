import { Link, useNavigate } from "react-router-dom";
import { signOut, useSession } from "../lib/auth-client";

export default function NavBar() {
  const { data: session } = useSession();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  return (
    <nav className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-6">
        <span className="font-semibold text-gray-800">ResolveMe</span>
        {session?.user?.role === "admin" && (
          <Link to="/user" className="text-sm text-gray-600 hover:text-gray-900 font-medium">
            Users
          </Link>
        )}
      </div>
      <div className="flex items-center gap-4">
        <span className="text-sm text-gray-600">
          {session?.user?.name || session?.user?.email}
        </span>
        <button
          onClick={handleSignOut}
          className="text-sm text-red-600 hover:text-red-700 font-medium"
        >
          Sign out
        </button>
      </div>
    </nav>
  );
}
