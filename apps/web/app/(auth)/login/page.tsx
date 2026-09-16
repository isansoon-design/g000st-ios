"use client";

import { useIdGate } from "@/features/auth/use-id-gate";

export default function LoginPage() {
  const idGate = useIdGate();
  const isBusy = idGate.busyAction !== null;

  if (idGate.createdAccount) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#E8E8E8] px-[22px] py-8">
        <section className="w-full max-w-[400px] rounded-[22px] border border-white/70 bg-[#F2F2F2] p-5 shadow-[0_16px_40px_rgba(0,0,0,.2)]">
          <div className="mb-2 text-center text-2xl font-black">
            g<span className="text-[#C62828]">000</span>st
          </div>
          <h1 className="text-center text-lg font-black text-[#111]">Save your Recovery ID</h1>
          <p className="mb-5 mt-2 text-center text-xs font-semibold leading-[18px] text-[#555]">
            Your Public ID is safe to share. Your Recovery ID is private and is shown only now.
          </p>

          <p className="mb-1 text-[10px] font-black uppercase tracking-[1px] text-black/50">
            Public ID · shareable
          </p>
          <div className="mb-3 rounded-[14px] border border-black/15 bg-white p-3">
            <p className="break-all font-mono text-xs font-black leading-[18px] text-[#C62828]">
              {idGate.createdAccount.user.publicId}
            </p>
            <button
              className="mt-3 h-9 w-full rounded-full border border-black/15 bg-[#E8E8E8] text-xs font-black text-[#111] active:opacity-70"
              onClick={idGate.copyPublicId}
              type="button"
            >
              Copy Public ID
            </button>
          </div>

          <p className="mb-1 text-[10px] font-black uppercase tracking-[1px] text-[#C62828]">
            Recovery ID · private
          </p>
          <div className="rounded-[14px] border-2 border-[#C62828] bg-white p-3">
            <p className="break-all font-mono text-xs font-black leading-[18px] text-[#C62828]">
              {idGate.createdAccount.recoveryId}
            </p>
            <button
              className="mt-3 h-10 w-full rounded-full bg-[#C62828] text-xs font-black text-white active:opacity-80"
              onClick={idGate.copyRecoveryId}
              type="button"
            >
              Copy Recovery ID
            </button>
          </div>

          <p className="my-4 text-center text-xs font-bold leading-[17px] text-[#C62828]">
            If you lose this Recovery ID, support cannot reveal it to you.
          </p>

          <button
            className="h-[50px] w-full rounded-[14px] bg-[#111] font-black text-white active:opacity-80 disabled:opacity-60"
            disabled={idGate.busyAction === "confirm"}
            onClick={idGate.confirmRecoverySaved}
            type="button"
          >
            {idGate.busyAction === "confirm" ? "..." : "I saved it · Continue"}
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#E8E8E8] px-[22px] py-6">
      <section className="w-full max-w-[400px]">
        <h1 className="mb-[10px] text-center text-[28px] font-black">
          g<span className="text-[#C62828]">000</span>st
        </h1>
        <p className="mb-[22px] text-center text-xs font-bold leading-[17px] text-[#444]">
          By using the app you are agreeing to our Terms &amp; Conditions and Privacy Policy.
        </p>

        <form
          className="mb-[22px]"
          onSubmit={(event) => {
            event.preventDefault();
            void idGate.submitCreate();
          }}
        >
          <input
            aria-invalid={!!idGate.errors.requestedPublicId}
            autoCapitalize="none"
            autoComplete="off"
            autoCorrect="off"
            className={`h-[50px] w-full rounded-[14px] bg-white px-[14px] font-extrabold text-[#111] outline-none ${
              idGate.errors.requestedPublicId
                ? "border-2 border-red-600"
                : "border-[1.5px] border-[#111]"
            }`}
            disabled={isBusy}
            maxLength={50}
            onChange={(event) => idGate.changeRequestedPublicId(event.target.value)}
            placeholder="Create your Public ID"
            spellCheck={false}
            type="text"
            value={idGate.requestedPublicId}
          />
          {idGate.errors.requestedPublicId && (
            <p className="mt-1 flex items-center gap-1 text-xs font-bold text-red-600" role="alert">
              <svg aria-hidden="true" className="h-3.5 w-3.5 shrink-0" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1Zm.75 3.75v4a.75.75 0 0 1-1.5 0v-4a.75.75 0 0 1 1.5 0ZM8 11a1 1 0 1 1 0 2 1 1 0 0 1 0-2Z" />
              </svg>
              {idGate.errors.requestedPublicId}
            </p>
          )}
          <button
            className="mt-2 h-[50px] w-full rounded-[14px] bg-[#111] font-black text-white active:opacity-80 disabled:opacity-60"
            disabled={isBusy}
            type="submit"
          >
            {idGate.busyAction === "create" ? "..." : "Enter"}
          </button>
        </form>

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
            className={`h-[50px] w-full rounded-[14px] border-2 bg-white px-[14px] font-extrabold text-[#C62828] outline-none ${
              idGate.errors.recoveryId ? "border-red-600" : "border-[#C62828]"
            }`}
            disabled={isBusy}
            maxLength={50}
            onChange={(event) => idGate.changeRecoveryId(event.target.value)}
            placeholder="Paste your Recovery ID"
            spellCheck={false}
            type="password"
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
            {idGate.busyAction === "restore" ? "..." : "Enter"}
          </button>
        </form>
      </section>
    </main>
  );
}
