import { useAuth } from "../auth/AuthContext";

export function useAuthGuard() {
  const { currentUser } = useAuth();
  return currentUser;
}
