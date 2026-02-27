import {
  ApiError,
  MeOut,
  getMe,
  logout,
  refreshTokens,
  requestOtp,
  runWithTokenRefresh,
  verifyOtp
} from "@blyss/shared";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { API_BASE_URL } from "../config";
import { clearTokens, getAccessToken, getRefreshToken, storeTokens } from "./sessionStorage";
import { logEvent } from "../lib/analytics";
import { getUserErrorMessage } from "../lib/errorMessages";

type AuthContextValue = {
  initializing: boolean;
  busy: boolean;
  currentUser: MeOut | null;
  pendingEmail: string;
  debugOtp: string | null;
  notice: string | null;
  error: string | null;
  clearBanner: () => void;
  requestOtpForEmail: (email: string) => Promise<boolean>;
  verifyPendingOtp: (otp: string) => Promise<boolean>;
  signOut: () => Promise<void>;
  withAuthenticated: <T>(operation: (accessToken: string) => Promise<T>) => Promise<T>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [initializing, setInitializing] = useState(true);
  const [busy, setBusy] = useState(false);
  const [currentUser, setCurrentUser] = useState<MeOut | null>(null);
  const [pendingEmail, setPendingEmail] = useState("");
  const [debugOtp, setDebugOtp] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>("Enter your email to receive a one-time code.");
  const [error, setError] = useState<string | null>(null);

  const clearLocalSession = useCallback(async () => {
    await clearTokens();
    setCurrentUser(null);
  }, []);

  const clearBanner = useCallback(() => {
    setNotice(null);
    setError(null);
  }, []);

  const withAuthenticated = useCallback(
    async <T,>(operation: (accessToken: string) => Promise<T>): Promise<T> => {
      const accessToken = await getAccessToken();
      const refreshToken = await getRefreshToken();

      if (!accessToken) {
        throw new ApiError(401, "Not signed in");
      }

      return runWithTokenRefresh({
        accessToken,
        refreshToken,
        execute: operation,
        refresh: (token) => refreshTokens({ refresh_token: token }, API_BASE_URL),
        onTokensRefreshed: async (tokens) => {
          await storeTokens(tokens);
        },
        onUnauthorized: async () => {
          await clearLocalSession();
        }
      });
    },
    [clearLocalSession]
  );

  const restoreSession = useCallback(async () => {
    setInitializing(true);

    try {
      const me = await withAuthenticated((token) => getMe(token, API_BASE_URL));
      setCurrentUser(me);
      setNotice("Session restored.");
      setError(null);
      logEvent("auth.session.restored", { user_id: me.id });
    } catch {
      await clearLocalSession();
      setNotice("Please sign in.");
      logEvent("auth.session.missing");
    } finally {
      setInitializing(false);
    }
  }, [clearLocalSession, withAuthenticated]);

  useEffect(() => {
    void restoreSession();
  }, [restoreSession]);

  const requestOtpForEmail = useCallback(async (email: string): Promise<boolean> => {
    setBusy(true);
    setError(null);
    setNotice("Sending OTP...");
    setDebugOtp(null);

    try {
      const trimmedEmail = email.trim().toLowerCase();
      const response = await requestOtp({ email: trimmedEmail }, API_BASE_URL);
      setPendingEmail(trimmedEmail);
      setDebugOtp(response.debug_otp ?? null);
      setNotice(response.message);
      logEvent("auth.otp.requested", { email_domain: trimmedEmail.split("@")[1] ?? "unknown" });
      return true;
    } catch (err) {
      const message = getUserErrorMessage(err, "Failed to send OTP");
      setError(message);
      logEvent("auth.otp.request_failed", { message });
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  const verifyPendingOtp = useCallback(
    async (otp: string): Promise<boolean> => {
      if (!pendingEmail) {
        setError("Request an OTP first.");
        return false;
      }

      setBusy(true);
      setError(null);
      setNotice("Verifying OTP...");

      try {
        const tokens = await verifyOtp({ email: pendingEmail, otp: otp.trim() }, API_BASE_URL);
        await storeTokens(tokens);
        const me = await withAuthenticated((token) => getMe(token, API_BASE_URL));
        setCurrentUser(me);
        setNotice("Signed in.");
        logEvent("auth.signin.success", { user_id: me.id });
        return true;
      } catch (err) {
        const message = getUserErrorMessage(err, "Failed to verify OTP");
        setError(message);
        logEvent("auth.signin.failed", { message });
        return false;
      } finally {
        setBusy(false);
      }
    },
    [pendingEmail, withAuthenticated]
  );

  const signOut = useCallback(async () => {
    setBusy(true);
    setError(null);

    try {
      const refreshToken = await getRefreshToken();
      if (refreshToken) {
        try {
          await logout({ refresh_token: refreshToken }, API_BASE_URL);
        } catch {
          // Ignore transport failure; local token purge is authoritative.
        }
      }
      await clearLocalSession();
      setPendingEmail("");
      setDebugOtp(null);
      setNotice("Signed out.");
      logEvent("auth.signout");
    } finally {
      setBusy(false);
    }
  }, [clearLocalSession]);

  const value = useMemo<AuthContextValue>(
    () => ({
      initializing,
      busy,
      currentUser,
      pendingEmail,
      debugOtp,
      notice,
      error,
      clearBanner,
      requestOtpForEmail,
      verifyPendingOtp,
      signOut,
      withAuthenticated
    }),
    [
      initializing,
      busy,
      currentUser,
      pendingEmail,
      debugOtp,
      notice,
      error,
      clearBanner,
      requestOtpForEmail,
      verifyPendingOtp,
      signOut,
      withAuthenticated
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return value;
}
