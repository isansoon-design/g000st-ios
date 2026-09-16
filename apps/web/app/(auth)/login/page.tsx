"use client";

import { Copy } from "lucide-react";

import { useIdGate } from "@/features/auth/use-id-gate";

export default function LoginPage() {
  const idGate = useIdGate();
  const isBusy = idGate.busyAction !== null;
  const isModalOpen = idGate.registrationModalStage !== "closed";

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
            placeholder="Enter your ID"
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
            {idGate.busyAction === "restore" ? "..." : "Login"}
          </button>
        </form>

        <button
          className="mt-3 h-[50px] w-full rounded-[14px] border-2 border-[#111] bg-transparent font-black text-[#111] active:opacity-70 disabled:opacity-60"
          disabled={isBusy}
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
          <section className="w-full max-w-[400px] rounded-[22px] border border-white/70 bg-[#F2F2F2] p-5 shadow-[0_16px_40px_rgba(0,0,0,.3)]">
            <div className="mb-2 text-center text-2xl font-black">
              g<span className="text-[#C62828]">000</span>st
            </div>

            {idGate.registrationModalStage === "confirm" ? (
              <>
                <h2 id="registration-modal-title" className="text-center text-lg font-black text-[#111]">
                  Create a new account?
                </h2>
                <p className="mb-6 mt-2 text-center text-sm font-semibold leading-5 text-[#555]">
                  Are you sure you want to create a new account?
                </p>
                <div className="flex gap-3">
                  <button
                    className="h-12 flex-1 rounded-[14px] border-2 border-[#111] font-black text-[#111] active:opacity-70 disabled:opacity-60"
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
                <h2 id="registration-modal-title" className="text-center text-lg font-black text-[#111]">
                  Your new account ID
                </h2>
                <p className="mb-4 mt-2 text-center text-xs font-semibold leading-[18px] text-[#555]">
                  Copy this ID now and keep it private. You will use it to log in.
                </p>
                <div className="flex overflow-hidden rounded-[14px] border-2 border-[#C62828] bg-white">
                  <input
                    aria-label="New account ID"
                    className="min-w-0 flex-1 bg-white px-3 font-mono text-xs font-black text-[#C62828] outline-none"
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
