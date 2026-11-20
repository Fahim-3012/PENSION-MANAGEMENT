import { Navigate, useLocation } from "react-router-dom";
import { homeFor, useAuth } from "../../context/AuthContext";
import { Spinner } from "../ui";

/** Guards routes by authentication and role. `roles` = any of the listed roles grants access. */
export default function ProtectedRoute({ roles, children }) {
  const { user, initializing } = useAuth();
  const location = useLocation();

  if (initializing) return <div style={{ paddingTop: "30vh" }}><Spinner /></div>;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (roles && !roles.some((r) => user.roles.includes(r))) return <Navigate to={homeFor(user)} replace />;
  return children;
}

/** Redirects signed-in users away from login/register. */
export function GuestRoute({ children }) {
  const { user, initializing } = useAuth();
  if (initializing) return <div style={{ paddingTop: "30vh" }}><Spinner /></div>;
  if (user) return <Navigate to={homeFor(user)} replace />;
  return children;
}
