import React, { useEffect, useRef, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { CheckCircle2, LogOut, RefreshCw } from "lucide-react";
import { getSupabaseClient, clearSupabasePatientCache } from "../lib/supabase";
import { accessErrorMessage, authErrorMessage, fetchAccessState } from "../lib/accountAuth";
import type { AccessState } from "../lib/accountAuth";
import type { UserRole } from "../types";
import { AccountAuthView } from "./AccountAuthView";
import { PatientWorkspace } from "./PatientWorkspace";
import { AdminWorkspace } from "./admin/AdminWorkspace";

interface Props {
  renderWorkspace: (
    role: UserRole,
    demo: boolean,
    onExit: () => void,
  ) => React.ReactNode;
}

export function AuthGateway({ renderWorkspace }: Props) {
  const [session, setSession] = useState<Session | null>(null);
  const acceptedUserId = useRef<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(false);
  const [demo, setDemo] = useState(false);
  const [recovery, setRecovery] = useState(
    () =>
      new URLSearchParams(window.location.search).get("auth") === "recovery",
  );
  const [error, setError] = useState(
    () =>
      new URLSearchParams(window.location.hash.slice(1)).get(
        "error_description",
      ) || "",
  );
  const [retry, setRetry] = useState(0);
  const [access, setAccess] = useState<AccessState | null>(null);
  const [accessLoading, setAccessLoading] = useState(false);
  const [accessError, setAccessError] = useState("");
  const [accessRetry, setAccessRetry] = useState(0);
  useEffect(() => {
    const client = getSupabaseClient();
    if (!client) {
      setSession(null);
      setChecking(false);
      setError("Supabase is not configured.");
      return;
    }
    const { data } = client.auth.onAuthStateChange((event, nextSession) => {
      if (event === "PASSWORD_RECOVERY") {
        acceptedUserId.current = null;
        clearSupabasePatientCache();
        setUser(null);
        setDemo(false);
        setRecovery(true);
        setSession(nextSession);
        return;
      }
      if (event === "SIGNED_OUT") {
        acceptedUserId.current = null;
        clearSupabasePatientCache();
        setUser(null);
        setSession(null);
        setDemo(false);
        setChecking(false);
        setAccess(null);
        setAccessError("");
        setAccessLoading(false);
        return;
      }
      if (event === "INITIAL_SESSION") return;
      // A restored session or background SIGNED_IN event must not skip the login form.
      // Only this page's successful password submission accepts an account.
      if (!acceptedUserId.current) return;
      if (nextSession?.user.id === acceptedUserId.current) {
        setDemo(false);
        setSession(nextSession);
      } else {
        acceptedUserId.current = null;
        clearSupabasePatientCache();
        setUser(null);
        setSession(null);
        setDemo(false);
        setChecking(false);
      }
    });
    return () => data.subscription.unsubscribe();
  }, []);
  useEffect(() => {
    if (!session) {
      setUser(null);
      setChecking(false);
      return;
    }
    let cancelled = false;
    setChecking(true);
    setUser(null);
    // Verify outside the auth event callback, avoiding Supabase's callback lock.
    getSupabaseClient()!
      .auth.getUser()
      .then(({ data, error: failure }) => {
        if (cancelled) return;
        if (failure || !data.user)
          setError(
            failure ? authErrorMessage(failure) : "Please sign in again.",
          );
        else {
          setUser(data.user);
          setError("");
        }
        setChecking(false);
      })
      .catch((failure) => {
        if (!cancelled) {
          setError(authErrorMessage(failure));
          setChecking(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [session, retry]);
  // Role, suspension and Doctor-application state are read from the database so
  // administrator changes take effect without trusting a stale client claim.
  useEffect(() => {
    if (!user) {
      setAccess(null);
      setAccessError("");
      setAccessLoading(false);
      return;
    }
    let cancelled = false;
    setAccessLoading(true);
    setAccess(null);
    setAccessError("");
    const client = getSupabaseClient();
    if (!client) {
      setAccessError("Supabase is not configured.");
      setAccessLoading(false);
      return;
    }
    fetchAccessState(client)
      .then((state) => {
        if (cancelled) return;
        setAccess(state);
        setAccessLoading(false);
      })
      .catch((failure) => {
        if (cancelled) return;
        setAccessError(accessErrorMessage(failure));
        setAccessLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user, accessRetry]);
  const signOut = async () => {
    try {
      const { error: failure } = await getSupabaseClient()!.auth.signOut({
        scope: "local",
      });
      if (failure) throw failure;
      acceptedUserId.current = null;
      setRecovery(false);
      setError("");
      setDemo(false);
      setUser(null);
      setSession(null);
      setAccess(null);
      setAccessError("");
      setAccessLoading(false);
      clearSupabasePatientCache();
      window.history.replaceState(null, "", window.location.pathname);
    } catch (failure) {
      setError(authErrorMessage(failure));
    }
  };
  if (checking || (user && accessLoading))
    return (
      <div
        className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-500"
        role="status"
      >
        Checking your session…
      </div>
    );
  if (session && !user)
    return (
      <AccountStatus
        title="We couldn’t verify your session"
        message={error}
        onExit={signOut}
        onRetry={() => setRetry((value) => value + 1)}
      />
    );
  if (!user || recovery) {
    if (!user && demo && !recovery)
      return <>{renderWorkspace("doctor", true, () => setDemo(false))}</>;
    return (
      <AccountAuthView
        key={recovery ? "recovery" : "signin"}
        recovery={recovery}
        initialError={error}
        onSignedIn={(next) => {
          acceptedUserId.current = next.user.id;
          clearSupabasePatientCache();
          setUser(null);
          setDemo(false);
          setRecovery(false);
          setError("");
          setChecking(true);
          setSession(next);
        }}
        onPasswordUpdated={() => {
          acceptedUserId.current = null;
          setSession(null);
          setUser(null);
          setRecovery(false);
          window.history.replaceState(null, "", window.location.pathname);
        }}
        onPreview={() => setDemo(true)}
      />
    );
  }
  if (!user.email_confirmed_at)
    return (
      <AccountStatus
        title="Confirm your email"
        message="Open the confirmation link in your inbox, then sign in again."
        onExit={signOut}
      />
    );
  if (accessError)
    return (
      <AccountStatus
        title="We couldn’t verify your account"
        message={accessError}
        onExit={signOut}
        onRetry={() => setAccessRetry((value) => value + 1)}
      />
    );
  if (!access)
    return (
      <AccountStatus
        title="Account access needs review"
        message="Your account does not have a platform profile yet. Contact your administrator."
        onExit={signOut}
        onRetry={() => setAccessRetry((value) => value + 1)}
      />
    );
  if (access.status === "suspended")
    return (
      <AccountStatus
        title="Account suspended"
        message="This account has been suspended by a platform administrator. Contact your administrator if you believe this is a mistake."
        onExit={signOut}
      />
    );
  if (access.role === "patient" && access.application?.status === "pending")
    return (
      <AccountStatus
        title="Doctor application under review"
        message="Your application has been received. An administrator will verify your professional registration; once approved, sign in again to open your Doctor workspace."
        onExit={signOut}
      />
    );
  if (access.role === "patient" && access.application?.status === "rejected")
    return (
      <AccountStatus
        title="Doctor application declined"
        message={
          access.application.review_note
            ? `Your application was declined: ${access.application.review_note}`
            : "Your application was declined by a platform administrator. Contact the administrator for details."
        }
        onExit={signOut}
      />
    );
  if (access.role === "patient")
    return (
      <PatientWorkspace
        key={user.id}
        user={user}
        error={error}
        onExit={signOut}
      />
    );
  if (access.role === "admin")
    return (
      <AdminWorkspace
        key={user.id}
        admin={{
          id: user.id,
          full_name: access.full_name || user.email || "Administrator",
          email: user.email || "",
        }}
        onExit={signOut}
      />
    );
  return (
    <>
      {error && (
        <p role="alert" className="bg-rose-50 p-4 text-sm text-rose-700">
          {error}
        </p>
      )}
      {renderWorkspace(access.role, false, signOut)}
    </>
  );
}

function AccountStatus({
  title,
  message,
  onExit,
  onRetry,
  children,
}: {
  title: string;
  message: string;
  onExit: () => void;
  onRetry?: () => void;
  children?: React.ReactNode;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <section className="w-full max-w-lg space-y-5 rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <CheckCircle2 className="h-9 w-9 text-blue-600" />
        <p className="text-xs font-bold uppercase tracking-widest text-blue-600">
          DiaTwin account
        </p>
        <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
        <p className="text-sm leading-relaxed text-slate-500">{message}</p>
        {children}
        <div className="flex flex-wrap gap-3">
          {onRetry && (
            <button
              onClick={onRetry}
              className="flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-600"
            >
              <RefreshCw className="h-4 w-4" />
              Check again
            </button>
          )}
          <button
            onClick={onExit}
            className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </section>
    </main>
  );
}
