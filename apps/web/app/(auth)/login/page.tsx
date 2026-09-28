"use client";

import axios from "@/app/api/axios";
import { sessionStorage, type SavedAccount } from "@/app/api/session-storage";
import { Copy } from "lucide-react";
import { useEffect, useState } from "react";

import { useIdGate } from "@/features/auth/use-id-gate";

export default function LoginPage() {
  const idGate = useIdGate();
  const [accounts, setAccounts] = useState<SavedAccount[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loginEnabled, setLoginEnabled] = useState(true);

  useEffect(() => { setAccounts(sessionStorage.listSavedAccounts()); }, []);
  useEffect(() => { void axios.get<{ pages: Record<string, boolean> }>('/communication/experience').then(({ data }) => setLoginEnabled(data.pages.login !== false)).catch(() => undefined); }, []);

  async function selectAccount(account: SavedAccount) {
    setSelectedId(account.publicId);
    try { await idGate.submitRestore(account.recoveryId); }
    finally { setSelectedId(null); }
  }

  function removeAccount(publicId: string) {
    if (!window.confirm("Remove this saved account and its Recovery ID from this browser?")) return;
    sessionStorage.removeSavedAccount(publicId);
    setAccounts(sessionStorage.listSavedAccounts());
  }
  const isBusy = idGate.busyAction !== null || selectedId !== null;
  const isModalOpen = idGate.registrationModalStage !== "closed";

  return (
    <main className="flex min-h-screen flex-col items-center justify-between bg-[#E8E8E8] dark:bg-night-canvas px-[22px] py-6">
      <section className="flex w-full flex-1 flex-col justify-center max-w-[400px]">
        <h1 className="mb-[10px] text-center text-[28px] font-black">
          g<span className="text-[#C62828]">000</span>st
        </h1>
        <p className="mb-[22px] text-center text-xs font-bold leading-[17px] text-[#444] dark:text-night-text">
          By using the app you are agreeing to our Terms &amp; Conditions and Privacy Policy.
        </p>
        {!loginEnabled && <p className="mb-4 rounded-xl bg-amber-100 p-3 text-center text-xs font-bold text-amber-900">Login is temporarily closed for regular users. Administrators can still sign in.</p>}

        {accounts.length > 0 && (
          <div className="mb-6">
            <h2 className="mb-2 text-sm font-black text-[#111] dark:text-night-text">Saved accounts</h2>
            {accounts.map((account) => (
              <div key={account.publicId} className="mb-2 flex items-center rounded-xl bg-white dark:bg-night-surface p-2">
                <button aria-label={`Sign in as ${account.displayName || account.publicId.slice(0, 8)}`} className="flex min-w-0 flex-1 items-center text-left disabled:opacity-60" disabled={isBusy || selectedId !== null} onClick={() => void selectAccount(account)} type="button">
                  {account.avatarUrl ? <img alt="" className="mr-3 h-10 w-10 rounded-full object-cover" src={account.avatarUrl} /> : <span className="mr-3 flex h-10 w-10 items-center justify-center rounded-full bg-[#C62828] font-black text-white">{(account.displayName || account.publicId).slice(0, 1).toUpperCase()}</span>}
                  <span className="min-w-0 flex-1 truncate font-bold text-[#111] dark:text-night-text">{account.displayName || account.publicId.slice(0, 8)}</span>
                  {selectedId === account.publicId && <span className="text-xs">...</span>}
                </button>
                <button aria-label={`Remove saved account ${account.displayName || account.publicId.slice(0, 8)}`} className="px-3 py-2 text-xs font-bold text-[#C62828] disabled:opacity-60" disabled={isBusy || selectedId !== null} onClick={() => removeAccount(account.publicId)} type="button">Remove</button>
              </div>
            ))}
          </div>
        )}

        <form
          onSubmit={(event) => {
            event.preventDefault();
            void idGate.submitRestore();
          }}
        >
          <input
            aria-invalid={!!idGate.errors.recoveryId}
            autoCapitalize="none"
            autoComplete="off"
            autoCorrect="off"
            className={`h-[50px] w-full rounded-[14px] border-2 bg-white dark:bg-night-surface px-[14px] font-extrabold text-[#C62828] outline-none ${idGate.errors.recoveryId ? "border-red-600" : "border-[#C62828]"
              }`}
            disabled={isBusy}
            maxLength={50}
            onChange={(event) => idGate.changeRecoveryId(event.target.value)}
            placeholder="Enter your ID"
            spellCheck={false}
            type="text"
            value={idGate.recoveryId}
          />
          {idGate.errors.recoveryId && (
            <p className="mt-1 flex items-center gap-1 text-xs font-bold text-red-600" role="alert">
              <svg aria-hidden="true" className="h-3.5 w-3.5 shrink-0" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1Zm.75 3.75v4a.75.75 0 0 1-1.5 0v-4a.75.75 0 0 1 1.5 0ZM8 11a1 1 0 1 1 0 2 1 1 0 0 1 0-2Z" />
              </svg>
              {idGate.errors.recoveryId}
            </p>
          )}
          <button
            className="mt-2 h-[50px] w-full rounded-[14px] bg-[#C62828] font-black text-white active:opacity-80 disabled:opacity-60"
            disabled={isBusy}
            type="submit"
          >
            {idGate.busyAction === "restore" ? "..." : "Login"}
          </button>
        </form>
      </section>

      <section className="w-full max-w-[400px] pb-[20px]">
        <button
          className="mt-3 h-[50px] w-full rounded-[14px] border-2 border-[#111] dark:border-night-border bg-black font-black text-white dark:text-night-text active:opacity-70 disabled:opacity-60"
          disabled={isBusy || !loginEnabled}
          onClick={idGate.requestRegistration}
          type="button"
        >
          Register
        </button>
      </section>

      {isModalOpen && (
        <div
          aria-labelledby="registration-modal-title"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          role="dialog"
        >
          <section className="w-full max-w-[400px] rounded-[22px] border border-white/70 dark:border-white/20 bg-[#F2F2F2] dark:bg-night-surface p-5 shadow-[0_16px_40px_rgba(0,0,0,.3)]">
            <div className="mb-2 text-center text-2xl font-black">
              g<span className="text-[#C62828]">000</span>st
            </div>

            {idGate.registrationModalStage === "confirm" ? (
              <>
                <h2 id="registration-modal-title" className=" mb-6 text-center text-lg font-black text-[#111] dark:text-night-text">
                  Create a new account
                </h2>

                <div className="flex gap-3">
                  <button
                    className="h-12 flex-1 rounded-[14px] border-2 border-[#111] dark:border-night-border font-black text-[#111] dark:text-night-text active:opacity-70 disabled:opacity-60"
                    disabled={isBusy}
                    onClick={idGate.cancelRegistration}
                    type="button"
                  >
                    Cancel
                  </button>
                  <button
                    className="h-12 flex-1 rounded-[14px] bg-[#C62828] font-black text-white active:opacity-80 disabled:opacity-60"
                    disabled={isBusy}
                    onClick={() => void idGate.confirmRegistration()}
                    type="button"
                  >
                    {idGate.busyAction === "create" ? "..." : "Create"}
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2 id="registration-modal-title" className="text-center text-lg font-black text-[#111] dark:text-night-text">
                  Your new account ID
                </h2>
                <p className="mb-4 mt-2 text-center text-xs font-semibold leading-[18px] text-[#555] dark:text-night-muted">
                  Copy this ID now and keep it private. You will use it to log in.
                </p>
                <div className="flex overflow-hidden rounded-[14px] border-2 border-[#C62828] bg-white dark:bg-night-surface">
                  <input
                    aria-label="New account ID"
                    className="min-w-0 flex-1 bg-white dark:bg-night-surface px-3 font-mono text-xs font-black text-[#C62828] outline-none"
                    readOnly
                    type="text"
                    value={idGate.createdRecoveryId ?? ""}
                  />
                  <button
                    aria-label="Copy new account ID"
                    className="flex h-[50px] w-[54px] shrink-0 items-center justify-center bg-[#C62828] text-white active:opacity-80"
                    onClick={() => void idGate.copyCreatedRecoveryId()}
                    type="button"
                  >
                    <Copy aria-hidden="true" className="h-5 w-5" />
                  </button>
                </div>
                <button
                  className="mt-3 h-[50px] w-full rounded-[14px] bg-[#C62828] font-black text-white active:opacity-80 disabled:opacity-60"
                  disabled={isBusy}
                  onClick={() => void idGate.loginWithNewId()}
                  type="button"
                >
                  {idGate.busyAction === "restore" ? "..." : "Login"}
                </button>
                <p className="mt-4 text-center text-xs font-bold leading-[17px] text-[#C62828]">
                  If you lose this ID, support cannot reveal it to you.
                </p>
              </>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
