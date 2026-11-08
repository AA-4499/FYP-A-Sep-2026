import React, { useEffect, useMemo, useState } from "react";
import { AlertCircle, BookOpen, CheckCircle2, Clock3, FilePlus2, RefreshCw, ShieldCheck } from "lucide-react";
import { getSupabaseClient } from "../lib/supabase";
import { getForecastApiUrl } from "../lib/forecast";

type TargetType = "concept" | "relationship" | "source";
type Operation = "create" | "update" | "retire";
type Decision = "under_review" | "approved" | "rejected" | "changes_requested";

type Proposal = {
  id: string;
  submitted_by: string;
  target_type: TargetType;
  operation: Operation;
  target_key: string;
  proposed_payload: Record<string, unknown>;
  change_reason: string;
  status: string;
  reviewed_by?: string | null;
  review_note?: string | null;
  created_at: string;
};

type ProposalsResponse = { proposals: Proposal[]; canReview: boolean; userId: string };

const inputClass = "mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-teal-500";
const labelClass = "block text-xs font-semibold text-slate-600";

async function requestApi<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const client = getSupabaseClient();
  if (!client) throw new Error("Supabase authentication is not configured.");
  const { data, error } = await client.auth.getSession();
  if (error) throw new Error(error.message);
  if (!data.session) throw new Error("Sign in with an authorised account to manage KG proposals.");
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

function cleanFields(source: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(source).filter(([, value]) =>
    value !== undefined && value !== null && value !== ""
  ));
}

function refsFromText(value: string): string[] {
  return value.split(/[,\s]+/).map(item => item.trim()).filter(Boolean);
}

function statusStyle(status: string): string {
  if (status === "approved") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (status === "rejected") return "border-rose-200 bg-rose-50 text-rose-800";
  if (status === "changes_requested") return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

export function KnowledgeGraphChangesView() {
  const [targetType, setTargetType] = useState<TargetType>("relationship");
  const [operation, setOperation] = useState<Operation>("create");
  const [targetKey, setTargetKey] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [canReview, setCanReview] = useState(false);
  const [currentUserId, setCurrentUserId] = useState("");
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});

  const [concept, setConcept] = useState({ name: "", category: "", description: "", sourceRefs: "", scope: "Type 2 Diabetes" });
  const [relationship, setRelationship] = useState({ from: "", predicate: "ASSOCIATED_WITH", to: "", sourceRefs: "", evidenceNote: "", evidenceType: "literature" });
  const [source, setSource] = useState({ ref: "", authors: "", title: "", publication: "", year: "", doi: "", url: "", kind: "research article", note: "" });

  async function loadProposals() {
    setLoading(true);
    setError("");
    try {
      const result = await requestApi<ProposalsResponse>("/api/doctor/knowledge-graph/proposals");
      setProposals(Array.isArray(result.proposals) ? result.proposals : []);
      setCanReview(result.canReview === true);
      setCurrentUserId(result.userId || "");
    } catch (failure) {
      setProposals([]);
      setError(failure instanceof Error ? failure.message : "Proposals could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadProposals(); }, []);

  const proposedPayload = useMemo(() => {
    if (operation === "retire") return {};
    if (targetType === "concept") {
      return cleanFields({
        name: concept.name.trim(),
        category: concept.category.trim(),
        description: concept.description.trim(),
        sourceRefs: refsFromText(concept.sourceRefs),
        scope: concept.scope.trim(),
      });
    }
    if (targetType === "relationship") {
      return cleanFields({
        from: relationship.from.trim(),
        relationship: relationship.predicate.trim(),
        to: relationship.to.trim(),
        sourceRefs: refsFromText(relationship.sourceRefs),
        evidenceNote: relationship.evidenceNote.trim(),
        evidenceType: relationship.evidenceType.trim(),
        scope: "Type 2 Diabetes",
        schemaVersion: "t2dm-medical-kg-v1",
      });
    }
    return cleanFields({
      ref: source.ref.trim(),
      authors: source.authors.trim(),
      title: source.title.trim(),
      publication: source.publication.trim(),
      year: source.year.trim() ? Number(source.year) : undefined,
      doi: source.doi.trim(),
      url: source.url.trim(),
      kind: source.kind.trim(),
      note: source.note.trim(),
    });
  }, [operation, targetType, concept, relationship, source]);

  async function submitProposal(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await requestApi("/api/doctor/knowledge-graph/proposals", "POST", {
        targetType,
        operation,
        targetKey: targetKey.trim(),
        proposedPayload,
        reason: reason.trim(),
      });
      setNotice("Your proposal was saved for review. The published graph was not changed.");
      setTargetKey("");
      setReason("");
      setConcept({ name: "", category: "", description: "", sourceRefs: "", scope: "Type 2 Diabetes" });
      setRelationship({ from: "", predicate: "ASSOCIATED_WITH", to: "", sourceRefs: "", evidenceNote: "", evidenceType: "literature" });
      setSource({ ref: "", authors: "", title: "", publication: "", year: "", doi: "", url: "", kind: "research article", note: "" });
      await loadProposals();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "The proposal could not be submitted.");
    } finally {
      setBusy(false);
    }
  }

  async function decide(proposal: Proposal, decision: Decision) {
    const note = (reviewNotes[proposal.id] || "").trim();
    if (!note) {
      setError("Enter a review note before recording a decision.");
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await requestApi(
        "/api/doctor/knowledge-graph/proposals/" + encodeURIComponent(proposal.id) + "/review",
        "POST",
        { decision, note },
      );
      setNotice(decision === "approved"
        ? "Proposal approved for a future curated release. The live graph has not changed."
        : "Review decision saved.");
      await loadProposals();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "The review decision could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  const pendingCount = proposals.filter(item => ["submitted", "under_review", "changes_requested"].includes(item.status)).length;

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-teal-100 bg-teal-50/70 p-4">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-teal-700" />
          <div>
            <h2 className="text-sm font-bold text-teal-950">Controlled graph changes</h2>
            <p className="mt-1 text-xs leading-5 text-teal-900">
              Doctors can propose concept, relationship and source changes. An explicitly appointed KG reviewer checks the evidence. Approval prepares a change for a future curator release; it never edits the published Aura graph directly.
            </p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-semibold">
          <span className="rounded-full border border-teal-200 bg-white px-2.5 py-1 text-teal-800">Draft proposals</span>
          <span className="rounded-full border border-teal-200 bg-white px-2.5 py-1 text-teal-800">Audited decisions</span>
          <span className="rounded-full border border-teal-200 bg-white px-2.5 py-1 text-teal-800">No direct Aura writes</span>
        </div>
      </section>

      {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800"><AlertCircle className="mr-2 inline h-4 w-4" />{error}</div>}
      {notice && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"><CheckCircle2 className="mr-2 inline h-4 w-4" />{notice}</div>}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900">Submit a change proposal</h2>
            <p className="mt-1 text-xs text-slate-500">The proposal will be stored separately from the published knowledge graph.</p>
          </div>
          <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-semibold text-slate-600">Doctor access</span>
        </div>
        <form onSubmit={submitProposal} className="mt-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="text-xs font-semibold text-slate-600">What are you changing?
              <select className={inputClass} value={targetType} onChange={e => setTargetType(e.target.value as TargetType)}>
                <option value="concept">Medical concept</option>
                <option value="relationship">Relationship</option>
                <option value="source">Literature source</option>
              </select>
            </label>
            <label className="text-xs font-semibold text-slate-600">Action
              <select className={inputClass} value={operation} onChange={e => setOperation(e.target.value as Operation)}>
                <option value="create">Propose new</option>
                <option value="update">Propose correction</option>
                <option value="retire">Propose retirement</option>
              </select>
            </label>
            <label className="text-xs font-semibold text-slate-600">Target key
              <input required className={inputClass} value={targetKey} onChange={e => setTargetKey(e.target.value)} placeholder={targetType === "concept" ? "e.g. Obesity" : targetType === "source" ? "e.g. [17]" : "From|PREDICATE|To"} />
            </label>
          </div>

          {operation !== "retire" && targetType === "concept" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className={labelClass}>Concept name<input className={inputClass} value={concept.name} onChange={e => setConcept(v => ({ ...v, name: e.target.value }))} /></label>
              <label className={labelClass}>Category<input className={inputClass} value={concept.category} onChange={e => setConcept(v => ({ ...v, category: e.target.value }))} placeholder="Disease, Measurement, Treatment…" /></label>
              <label className={labelClass + " sm:col-span-2"}>Description<textarea className={inputClass} rows={2} value={concept.description} onChange={e => setConcept(v => ({ ...v, description: e.target.value }))} /></label>
              <label className={labelClass}>Source IDs, comma separated<input className={inputClass} value={concept.sourceRefs} onChange={e => setConcept(v => ({ ...v, sourceRefs: e.target.value }))} placeholder="[1], [17]" /></label>
              <label className={labelClass}>Scope<input className={inputClass} value={concept.scope} onChange={e => setConcept(v => ({ ...v, scope: e.target.value }))} /></label>
            </div>
          )}

          {operation !== "retire" && targetType === "relationship" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className={labelClass}>From concept<input className={inputClass} value={relationship.from} onChange={e => setRelationship(v => ({ ...v, from: e.target.value }))} /></label>
              <label className={labelClass}>Relationship predicate<input className={inputClass} value={relationship.predicate} onChange={e => setRelationship(v => ({ ...v, predicate: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, "_") }))} /></label>
              <label className={labelClass}>To concept<input className={inputClass} value={relationship.to} onChange={e => setRelationship(v => ({ ...v, to: e.target.value }))} /></label>
              <label className={labelClass}>Source IDs, comma separated<input className={inputClass} value={relationship.sourceRefs} onChange={e => setRelationship(v => ({ ...v, sourceRefs: e.target.value }))} placeholder="[1], [17]" /></label>
              <label className={labelClass + " sm:col-span-2"}>Evidence note<textarea className={inputClass} rows={3} value={relationship.evidenceNote} onChange={e => setRelationship(v => ({ ...v, evidenceNote: e.target.value }))} /></label>
            </div>
          )}

          {operation !== "retire" && targetType === "source" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className={labelClass}>Reference ID<input className={inputClass} value={source.ref} onChange={e => setSource(v => ({ ...v, ref: e.target.value }))} placeholder="[17]" /></label>
              <label className={labelClass}>Authors<input className={inputClass} value={source.authors} onChange={e => setSource(v => ({ ...v, authors: e.target.value }))} /></label>
              <label className={labelClass + " sm:col-span-2"}>Title<input className={inputClass} value={source.title} onChange={e => setSource(v => ({ ...v, title: e.target.value }))} /></label>
              <label className={labelClass}>Journal / publisher<input className={inputClass} value={source.publication} onChange={e => setSource(v => ({ ...v, publication: e.target.value }))} /></label>
              <label className={labelClass}>Publication year<input type="number" className={inputClass} value={source.year} onChange={e => setSource(v => ({ ...v, year: e.target.value }))} /></label>
              <label className={labelClass}>DOI<input className={inputClass} value={source.doi} onChange={e => setSource(v => ({ ...v, doi: e.target.value }))} /></label>
              <label className={labelClass}>Publisher URL<input type="url" className={inputClass} value={source.url} onChange={e => setSource(v => ({ ...v, url: e.target.value }))} /></label>
              <label className={labelClass + " sm:col-span-2"}>Reviewer note<textarea className={inputClass} rows={2} value={source.note} onChange={e => setSource(v => ({ ...v, note: e.target.value }))} /></label>
            </div>
          )}

          {operation === "retire" && (
            <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
              Retirement is a soft status proposal. It does not delete the concept, source or relationship, and a reviewer must check dependencies before approval.
            </p>
          )}
          <label className={labelClass}>Reason and supporting context<textarea required className={inputClass} rows={3} value={reason} onChange={e => setReason(e.target.value)} placeholder="Explain why this change is needed and what evidence supports it." /></label>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-[11px] text-slate-500">Source IDs must match entries in the project bibliography.</p>
            <button type="submit" disabled={busy} className="inline-flex items-center gap-2 rounded-xl bg-teal-700 px-4 py-2.5 text-xs font-bold text-white hover:bg-teal-800 disabled:opacity-50">
              <FilePlus2 className="h-4 w-4" />{busy ? "Saving…" : "Submit proposal"}
            </button>
          </div>
        </form>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="text-base font-bold text-slate-900">{canReview ? "Review queue" : "My proposals"}</h2><p className="mt-1 text-xs text-slate-500">{pendingCount} awaiting a final decision · {proposals.length} visible</p></div>
          <button type="button" onClick={() => void loadProposals()} disabled={loading || busy} className="inline-flex items-center gap-2 text-xs font-semibold text-teal-700 disabled:opacity-50"><RefreshCw className={"h-3.5 w-3.5 " + (loading ? "animate-spin" : "")} />Refresh</button>
        </div>
        {loading && <p role="status" className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">Loading proposals…</p>}
        {!loading && proposals.length === 0 && <p className="rounded-xl border border-dashed border-slate-200 bg-white p-6 text-sm text-slate-500">No proposals are available. Submit a change above, or check back after a Doctor submits one.</p>}
        {proposals.map(proposal => (
          <article key={proposal.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-md bg-slate-100 px-2 py-1 text-[10px] font-bold uppercase text-slate-600">{proposal.target_type}</span>
                <span className="text-sm font-semibold text-slate-900">{proposal.operation} · {proposal.target_key}</span>
              </div>
              <span className={"rounded-full border px-2.5 py-1 text-[10px] font-bold " + statusStyle(proposal.status)}>{proposal.status.replace(/_/g, " ")}</span>
            </div>
            <p className="mt-3 text-xs leading-5 text-slate-600">{proposal.change_reason}</p>
            {Object.keys(proposal.proposed_payload || {}).length > 0 && <pre className="mt-3 overflow-x-auto rounded-xl bg-slate-50 p-3 text-[11px] leading-5 text-slate-700">{JSON.stringify(proposal.proposed_payload, null, 2)}</pre>}
            {proposal.review_note && <p className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-700"><strong>Reviewer note:</strong> {proposal.review_note}</p>}
            {canReview && proposal.submitted_by !== currentUserId && ["submitted", "under_review", "changes_requested"].includes(proposal.status) && (
              <div className="mt-4 border-t border-slate-100 pt-4">
                <label className={labelClass}>Review decision note<textarea className={inputClass} rows={2} value={reviewNotes[proposal.id] || ""} onChange={e => setReviewNotes(v => ({ ...v, [proposal.id]: e.target.value }))} placeholder="Explain the evidence check and reason for your decision." /></label>
                <div className="mt-3 flex flex-wrap gap-2">
                  {([
                    ["under_review", "Take for review"],
                    ["changes_requested", "Request changes"],
                    ["rejected", "Reject"],
                    ["approved", "Approve for release"],
                  ] as [Decision, string][]).map(([decision, label]) => (
                    <button key={decision} type="button" disabled={busy} onClick={() => void decide(proposal, decision)} className="rounded-lg border border-slate-200 px-3 py-2 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">{label}</button>
                  ))}
                </div>
              </div>
            )}
            {proposal.status === "approved" && <p className="mt-3 flex items-center gap-2 text-[11px] font-semibold text-emerald-700"><CheckCircle2 className="h-4 w-4" />Approved for a future curator release. Not yet published to Aura.</p>}
          </article>
        ))}
      </section>

      <p className="flex items-start gap-2 rounded-xl border border-slate-200 bg-white p-3 text-[11px] leading-5 text-slate-500">
        <Clock3 className="mt-0.5 h-4 w-4 shrink-0" />
        This page records proposals and review decisions only. No button here can edit or delete the published Aura graph. Permanent deletion is intentionally unavailable.
      </p>
    </div>
  );
}

export default KnowledgeGraphChangesView;
