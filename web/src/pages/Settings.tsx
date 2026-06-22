import { useEffect, useState } from "react";
import { api, ApiError, Settings, Token } from "../api";
import { Empty, Field, Modal, timeAgo } from "../ui";

export default function SettingsPage() {
  return (
    <div className="space-y-10">
      <GeneralSettings />
      <ApiTokens />
    </div>
  );
}

// GeneralSettings holds runtime configuration: reserved slugs / mailboxes and a
// global Cloudflare API token used as a fallback for sync and DNS operations.
function GeneralSettings() {
  const [s, setS] = useState<Settings | null>(null);
  const [reservedSlugs, setReservedSlugs] = useState("");
  const [reservedMailboxes, setReservedMailboxes] = useState("");
  const [cfToken, setCfToken] = useState("");
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  async function load() {
    const v = await api.settings();
    setS(v);
    setReservedSlugs(v.reservedSlugs);
    setReservedMailboxes(v.reservedMailboxes);
  }
  useEffect(() => {
    load();
  }, []);

  async function save() {
    setBusy(true);
    setSaved(false);
    try {
      const payload: any = { reservedSlugs, reservedMailboxes };
      if (cfToken.trim()) payload.cloudflareToken = cfToken.trim();
      const v = await api.updateSettings(payload);
      setS(v);
      setCfToken("");
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setBusy(false);
    }
  }

  if (!s) return <div className="text-zinc-500">loading…</div>;

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-xl font-semibold">Settings</h1>
        <p className="text-sm text-zinc-500">Runtime configuration for this instance.</p>
      </div>
      <div className="card space-y-5 p-5">
        <Field
          label="Reserved slugs"
          hint={`These can't be used for short links. Always reserved: ${s.builtinReserved.join(", ")}. One per line or comma-separated.`}
        >
          <textarea
            className="input font-mono"
            rows={3}
            value={reservedSlugs}
            onChange={(e) => setReservedSlugs(e.target.value)}
            placeholder="pricing&#10;login&#10;about"
          />
        </Field>
        <Field
          label="Reserved mailbox prefixes"
          hint="Local-parts (before @) that catch-all will NOT auto-create, e.g. admin, postmaster, abuse."
        >
          <textarea
            className="input font-mono"
            rows={2}
            value={reservedMailboxes}
            onChange={(e) => setReservedMailboxes(e.target.value)}
            placeholder="admin&#10;postmaster"
          />
        </Field>
        <Field
          label="Cloudflare API token"
          hint={
            s.cloudflareTokenSet
              ? "A token is set (encrypted). Sync & DNS use it when a domain has no own token. Enter a new value to replace."
              : "Optional global token used by Sync and as a fallback for DNS operations. Zone:Read + DNS:Edit."
          }
        >
          <input
            className="input"
            value={cfToken}
            onChange={(e) => setCfToken(e.target.value)}
            placeholder={s.cloudflareTokenSet ? "•••••••• (set)" : "Cloudflare API token"}
          />
          {s.cloudflareTokenSet && (
            <button
              className="btn-ghost mt-1.5 text-red-400"
              onClick={async () => {
                await api.updateSettings({ cloudflareToken: "" });
                load();
              }}
            >
              Clear stored token
            </button>
          )}
        </Field>
        <div className="flex items-center gap-3">
          <button className="btn-primary" onClick={save} disabled={busy}>
            {busy ? "Saving…" : "Save settings"}
          </button>
          {saved && <span className="text-sm text-green-400">✓ saved</span>}
        </div>
      </div>
    </div>
  );
}

function ApiTokens() {
  const [tokens, setTokens] = useState<Token[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<{ token: string } | null>(null);

  async function load() {
    setLoading(true);
    try {
      setTokens(await api.tokens());
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function remove(id: number) {
    if (!confirm("Revoke this token? Any client using it will stop working.")) return;
    await api.deleteToken(id);
    load();
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">API Tokens</h1>
          <p className="text-sm text-zinc-500">
            Bearer tokens for the open API. Send as{" "}
            <code className="rounded bg-zinc-800 px-1">Authorization: Bearer led_…</code>
          </p>
        </div>
        <button className="btn-primary" onClick={() => setCreating(true)}>
          + New token
        </button>
      </div>

      {loading ? (
        <div className="text-zinc-500">loading…</div>
      ) : tokens.length === 0 ? (
        <Empty>
          <div className="text-2xl">🔑</div>
          <div>No API tokens yet.</div>
        </Empty>
      ) : (
        <div className="card divide-y divide-zinc-800">
          {tokens.map((t) => (
            <div key={t.id} className="flex items-center justify-between p-4">
              <div>
                <div className="font-medium">{t.name}</div>
                <div className="text-xs text-zinc-500">
                  <code className="rounded bg-zinc-800 px-1">{t.prefix}…</code>
                  {t.note && <span className="ml-2">{t.note}</span>}
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-xs text-zinc-500">
                  {t.lastUsedAt ? `used ${timeAgo(t.lastUsedAt)}` : "never used"}
                </span>
                <button className="btn-ghost text-red-400" onClick={() => remove(t.id)}>
                  Revoke
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {creating && (
        <CreateTokenModal
          onClose={() => setCreating(false)}
          onCreated={(raw) => {
            setCreating(false);
            setCreated({ token: raw });
            load();
          }}
        />
      )}

      {created && (
        <Modal title="Token created" onClose={() => setCreated(null)}>
          <p className="mb-3 text-sm text-zinc-400">
            Copy this token now — it will <b>not</b> be shown again.
          </p>
          <div className="mb-4 break-all rounded-lg bg-zinc-800 p-3 font-mono text-sm">
            {created.token}
          </div>
          <button
            className="btn-primary w-full"
            onClick={() => {
              navigator.clipboard?.writeText(created.token);
            }}
          >
            Copy to clipboard
          </button>
        </Modal>
      )}
    </div>
  );
}

function CreateTokenModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (rawToken: string) => void;
}) {
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      const res = await api.createToken({ name, note });
      onCreated(res.token);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="New API token" onClose={onClose}>
      <form onSubmit={submit}>
        <Field label="Name">
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. ci-deploy"
            autoFocus
          />
        </Field>
        <Field label="Note" hint="Optional free-text remark.">
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        {err && <p className="mb-3 text-sm text-red-400">{err}</p>}
        <button className="btn-primary w-full" disabled={busy || !name.trim()}>
          {busy ? "…" : "Create token"}
        </button>
      </form>
    </Modal>
  );
}
