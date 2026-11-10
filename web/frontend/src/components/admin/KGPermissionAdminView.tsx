import React, { useEffect, useState } from "react";
import { CheckCircle2, KeyRound, RefreshCw, ShieldCheck } from "lucide-react";
import { getSupabaseClient } from "../../lib/supabase";
import { getForecastApiUrl } from "../../lib/forecast";

type Permission = {
  user_id: string;
  permission: "kg_reviewer" | "kg_curator";
  granted_by: string;
  reason: string;
  created_at: string;
};

async function requestApi<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const client = getSupabaseClient();
  if (!client) throw new Error("Supabase authentication is not configured.");
  const { data, error } = await client.auth.getSession();
  if (error) throw new Error(error.message);
  if (!data.session) throw new Error("Sign in with an Admin account.");
  const base = getForecastApiUrl();
  if (!base) throw new Error("The Python backend is not configured.");
  const response = await fetch(base + path, {
    method,
    headers: {
      Authorization: "Bearer " + data.session.access_token,
      Accept: "application/json",
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof payload.error === "string" ? payload.error : "Request failed (" + response.status + ").");
  return payload as T;
}

const field = "mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-500";

export function KGPermissionAdminView() {
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [userId, setUserId] = useState("");
  const [permission, setPermission] = useState<"kg_reviewer" | "kg_curator">("kg_reviewer");
  const [enabled, setEnabled] = useState(true);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const result = await requestApi<{ permissions: Permission[] }>("/api/admin/knowledge-graph/permissions");
      setPermissions(Array.isArray(result.permissions) ? result.permissions : []);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "KG permissions could not be loaded.");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { void load(); }, []);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await requestApi("/api/admin/knowledge-graph/permissions", "POST", {
        userId: userId.trim(),
        permission,
        enabled,
        reason: reason.trim(),
      });
      setNotice(enabled ? "Permission granted." : "Permission revoked.");
      setUserId("");
      setReason("");
      await load();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Permission change failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-indigo-100 bg-indigo-50/70 p-4">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-indigo-700" />
          <div>
            <h2 className="text-sm font-bold text-indigo-950">Knowledge Graph permissions</h2>
            <p className="mt-1 text-xs leading-5 text-indigo-900">
              Grant reviewer and curator capabilities separately from platform roles. Being a Platform Admin does not automatically make someone a clinical KG reviewer. A Doctor can review proposals only after kg_reviewer is explicitly granted.
            </p>
          </div>
        </div>
      </section>
      {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
      {notice && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"><CheckCircle2 className="mr-2 inline h-4 w-4" />{notice}</p>}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-bold text-slate-900">Grant or revoke a permission</h2>
        <form onSubmit={save} className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-semibold text-slate-600 sm:col-span-2">Supabase user UUID<input required className={field} value={userId} onChange={e => setUserId(e.target.value)} placeholder="Paste the user's auth UUID" /></label>
          <label className="text-xs font-semibold text-slate-600">Permission<select className={field} value={permission} onChange={e => setPermission(e.target.value as "kg_reviewer" | "kg_curator")}><option value="kg_reviewer">KG reviewer — verify evidence and review proposals</option><option value="kg_curator">KG curator — future publication and rollback controls</option></select></label>
          <label className="text-xs font-semibold text-slate-600">Action<select className={field} value={enabled ? "grant" : "revoke"} onChange={e => setEnabled(e.target.value === "grant")}><option value="grant">Grant</option><option value="revoke">Revoke</option></select></label>
          <label className="text-xs font-semibold text-slate-600 sm:col-span-2">Reason<input required className={field} value={reason} onChange={e => setReason(e.target.value)} placeholder="Record the administrative reason" /></label>
          <div className="sm:col-span-2"><button disabled={busy} className="inline-flex items-center gap-2 rounded-xl bg-indigo-700 px-4 py-2.5 text-xs font-bold text-white hover:bg-indigo-800 disabled:opacity-50"><KeyRound className="h-4 w-4" />{busy ? "Saving…" : enabled ? "Grant permission" : "Revoke permission"}</button></div>
        </form>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3"><div><h2 className="text-base font-bold text-slate-900">Current grants</h2><p className="mt-1 text-xs text-slate-500">{permissions.length} permission records</p></div><button type="button" onClick={() => void load()} disabled={loading} className="inline-flex items-center gap-2 text-xs font-semibold text-indigo-700 disabled:opacity-50"><RefreshCw className={"h-3.5 w-3.5 " + (loading ? "animate-spin" : "")} />Refresh</button></div>
        {loading ? <p role="status" className="mt-4 text-sm text-slate-500">Loading permission grants…</p> : permissions.length === 0 ? <p className="mt-4 text-sm text-slate-500">No KG reviewer or curator permissions have been granted.</p> : (
          <div className="mt-4 overflow-x-auto"><table className="w-full text-left text-xs"><thead className="text-slate-500"><tr><th className="py-2 pr-4">User UUID</th><th className="py-2 pr-4">Permission</th><th className="py-2 pr-4">Granted by</th><th className="py-2">Reason</th></tr></thead><tbody>{permissions.map((item, i) => <tr key={item.user_id + item.permission} className="border-t border-slate-100"><td className="max-w-56 break-all py-3 pr-4 font-mono">{item.user_id}</td><td className="py-3 pr-4 font-semibold">{item.permission.replace("kg_", "")}</td><td className="max-w-48 break-all py-3 pr-4 font-mono">{item.granted_by}</td><td className="py-3 text-slate-600">{item.reason}</td></tr>)}</tbody></table></div>
        )}
      </section>
      <p className="rounded-xl border border-slate-200 bg-white p-3 text-[11px] leading-5 text-slate-500">These permissions control proposal review access only. Curator publication and Aura rollback are intentionally not enabled in this release.</p>
    </div>
  );
}

export default KGPermissionAdminView;
