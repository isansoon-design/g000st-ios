"use client";

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import axios from '@/app/api/axios';

type SupportConfigV1 = Readonly<{ version: 1; publicId: string | null }>;

export function SupportAccountSettings() {
  const [config, setConfig] = useState<SupportConfigV1 | null>(null);
  const [kind, setKind] = useState<'public' | 'recovery'>('public');
  const [identifier, setIdentifier] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let active = true;
    setError('');
    void axios.get<SupportConfigV1>('/admin/support').then(({ data }) => {
      if (active) setConfig(data);
    }).catch(() => { if (active) setError('Could not load the support account.'); });
    return () => { active = false; };
  }, [revision]);

  async function save(disable = false) {
    setBusy(true);
    setError('');
    try {
      const { data } = await axios.put<SupportConfigV1>('/admin/support', { kind, identifier: disable ? null : identifier.trim() });
      setIdentifier('');
      setConfig(data);
      toast.success(disable ? 'Support chat disabled' : 'Support account saved');
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not save the support account.');
    } finally { setBusy(false); }
  }

  return <section className="mb-5 rounded-xl border-2 border-black p-4" aria-label="Support chat account">
    <h3 className="font-black">CONTACT US · CHAT ACCOUNT</h3>
    <p className="mt-2 text-sm">Users open a private chat with this account from Contact us on web and mobile.</p>
    <p className="mt-2 break-all text-xs">{config ? config.publicId ? `Current Public ID: ${config.publicId}` : 'No active support account configured.' : 'Loading support account…'}</p>
    <form className="mt-3 space-y-3" onSubmit={(event) => { event.preventDefault(); void save(); }}>
      <label className="block text-sm font-bold">ID type
        <select value={kind} disabled={busy} onChange={(event) => { setKind(event.target.value as 'public' | 'recovery'); setIdentifier(''); }} className="mt-1 w-full rounded-lg border-2 border-black bg-white p-2">
          <option value="public">Public ID</option><option value="recovery">Recovery ID</option>
        </select>
      </label>
      <label className="block text-sm font-bold">Support account ID
        <input type={kind === 'recovery' ? 'password' : 'text'} value={identifier} disabled={busy} onChange={(event) => setIdentifier(event.target.value)} autoComplete="off" spellCheck={false} required minLength={50} maxLength={50} pattern="[A-Za-z0-9]{50}" className="mt-1 w-full rounded-lg border-2 border-black bg-white p-2" />
      </label>
      <p className="text-xs text-gray-600">Recovery IDs are resolved on the server. Only the Public ID is saved.</p>
      <div className="flex flex-wrap gap-2">
        <button disabled={busy || !config} className="rounded-full bg-black px-4 py-2 text-xs font-black text-white disabled:opacity-50">{busy ? 'Saving…' : 'SAVE SUPPORT ACCOUNT'}</button>
        <button type="button" disabled={busy || !config?.publicId} onClick={() => void save(true)} className="rounded-full border-2 border-black px-4 py-2 text-xs font-black disabled:opacity-50">DISABLE CHAT</button>
      </div>
    </form>
    {error && <div role="alert" className="mt-3 text-sm text-red-700">{error} {!config && <button type="button" className="underline" onClick={() => setRevision((value) => value + 1)}>Retry</button>}</div>}
  </section>;
}
