"use client";

import {
  deleteRssSource,
  getRssSources,
  saveRssSource,
  type RssInputV1,
  type RssSourceV1,
} from "@/app/api/admin-rss";
import { isAxiosError } from "axios";
import { getCurrentUser } from "@/app/api/auth";
import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";

const empty: RssInputV1 = {
  name: "",
  url: "",
  accountPublicId: "",
  intervalMinutes: 60,
  enabled: true,
};
const field =
  "w-full rounded-lg border border-gray-300 bg-white p-3 dark:border-night-border dark:bg-night-surface";
const button =
  "rounded-lg border border-gray-300 px-4 py-2 disabled:opacity-50 dark:border-night-border";
function inputOf(source: RssSourceV1): RssInputV1 {
  return {
    name: source.name,
    url: source.url,
    accountPublicId: source.accountPublicId,
    intervalMinutes: source.intervalMinutes,
    enabled: source.enabled,
  };
}
function message(error: unknown): string {
  return isAxiosError(error) &&
    typeof error.response?.data?.message === "string"
    ? error.response.data.message
    : "Could not complete the request. Please try again.";
}
function date(value: number | null) {
  return value ? new Date(value).toLocaleString() : "—";
}

export default function RssPage() {
  const [sources, setSources] = useState<RssSourceV1[]>([]);
  const [form, setForm] = useState<RssInputV1>(empty);
  const [editing, setEditing] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const refresh = useCallback(async () => {
    setSources(await getRssSources());
  }, []);
  useEffect(() => {
    void refresh()
      .catch((error) => setError(message(error)))
      .finally(() => setLoading(false));
    const timer = setInterval(() => {
      void refresh().catch(() => {});
    }, 30_000);
    return () => clearInterval(timer);
  }, [refresh]);
  async function mutate(action: () => Promise<void>, notice: string) {
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      await action();
      setSuccess(notice);
      await refresh();
    } catch (error) {
      setError(message(error));
    } finally {
      setBusy(false);
    }
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    await mutate(async () => {
      await saveRssSource(form, editing);
      setEditing(undefined);
      setForm(empty);
    }, "Source saved. The next run follows the selected interval.");
  }
  async function useCurrentAccount() {
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const { data } = await getCurrentUser();
      setForm((current) => ({ ...current, accountPublicId: data.user.publicId }));
      setSuccess("Your current account's Public ID is selected. Save the source to apply it.");
    } catch (error) {
      setError(message(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 text-gray-900 sm:p-8 dark:text-night-text">
      <div>
        <h1 className="text-2xl font-bold">RSS publishing</h1>
        <p className="mt-2 text-gray-600 dark:text-night-muted">
          Publish one unseen article per source at each interval, using the
          selected account. Posts include the title, summary and source link.
          RSS and Atom are supported.
        </p>
      </div>
      {error && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-700">
          {error}
        </p>
      )}
      {success && (
        <p role="status" className="rounded-lg bg-green-50 p-3 text-green-800">
          {success}
        </p>
      )}
      <form
        onSubmit={submit}
        className="space-y-4 rounded-xl border border-gray-200 p-5 dark:border-night-border"
      >
        <h2 className="text-lg font-semibold">
          {editing ? "Edit source" : "Add source"}
        </h2>
        <fieldset disabled={busy} className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1">
            Source name
            <input
              required
              maxLength={100}
              className={field}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </label>
          <label className="space-y-1">
            Feed URL
            <input
              required
              type="url"
              maxLength={2048}
              placeholder="https://example.com/feed.xml"
              className={field}
              value={form.url}
              onChange={(e) => setForm({ ...form, url: e.target.value })}
            />
          </label>
          <div className="space-y-1">
            <label htmlFor="rss-account-public-id">Publishing account Public ID</label>
            <input
              id="rss-account-public-id"
              required
              minLength={50}
              maxLength={50}
              pattern="[A-Za-z0-9]{50}"
              title="The account's 50-character Public ID"
              className={`${field} font-mono text-sm`}
              value={form.accountPublicId}
              onChange={(e) =>
                setForm({ ...form, accountPublicId: e.target.value.trim() })
              }
            />
            <span className="block text-sm text-gray-500">
              Use the Public ID from Users, not the secret Recovery ID used to sign in.
            </span>
            <button type="button" disabled={busy} className={button} onClick={() => void useCurrentAccount()}>
              Use my current account
            </button>
          </div>
          <label className="space-y-1">
            Publish every (minutes)
            <input
              required
              type="number"
              min={1}
              max={43200}
              step={1}
              className={field}
              value={
                Number.isNaN(form.intervalMinutes) ? "" : form.intervalMinutes
              }
              onChange={(e) =>
                setForm({ ...form, intervalMinutes: e.target.valueAsNumber })
              }
            />
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.enabled}
              onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
            />
            Publishing enabled
          </label>
        </fieldset>
        <p className="text-sm text-gray-500">
          The first post is scheduled after one interval. Saving settings
          restarts that interval. If there are no unseen articles, nothing is
          published.
        </p>
        <div className="flex gap-2">
          <button
            disabled={busy}
            className="rounded-lg bg-red-600 px-4 py-2 text-white disabled:opacity-50"
          >
            {busy ? "Saving…" : "Save source"}
          </button>
          {editing && (
            <button
              type="button"
              disabled={busy}
              className={button}
              onClick={() => {
                setEditing(undefined);
                setForm(empty);
              }}
            >
              Cancel edit
            </button>
          )}
        </div>
      </form>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Sources</h2>
        <button
          disabled={busy}
          className={button}
          onClick={() => void mutate(refresh, "Status refreshed.")}
        >
          Refresh
        </button>
      </div>
      {loading ? (
        <p role="status">Loading sources…</p>
      ) : sources.length === 0 ? (
        <p>No RSS sources yet.</p>
      ) : (
        sources.map((source) => (
          <article
            key={source.id}
            className="space-y-3 rounded-xl border border-gray-200 p-5 dark:border-night-border"
          >
            <div className="flex flex-wrap justify-between gap-2">
              <h3 className="font-semibold">{source.name}</h3>
              <span>
                {source.enabled ? "Enabled" : "Paused"} · Every{" "}
                {source.intervalMinutes} min · {source.publishedCount} posts
              </span>
            </div>
            <p className="break-all text-sm">{source.url}</p>
            <p className="break-all text-sm">
              Account:{" "}
              <Link
                className="underline"
                href={`/users/${source.accountPublicId}`}
              >
                {source.accountPublicId}
              </Link>
            </p>
            <div className="grid gap-2 text-sm sm:grid-cols-3">
              <p>Next run: {date(source.nextRunAtMs)}</p>
              <p>Last check: {date(source.lastCheckedAtMs)}</p>
              <p>Last published: {date(source.lastPublishedAtMs)}</p>
            </div>
            {source.lastPostId && (
              <Link
                className="inline-block text-sm underline"
                href={`/posts/social/${source.lastPostId}`}
              >
                View last post
              </Link>
            )}
            {source.lastError && (
              <p className="text-sm text-red-600" role="status">
                {source.lastError}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <button
                disabled={busy}
                className={button}
                onClick={() => {
                  setEditing(source.id);
                  setForm(inputOf(source));
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
              >
                Edit
              </button>
              <button
                disabled={busy}
                className={button}
                onClick={() =>
                  void mutate(
                    () =>
                      saveRssSource(
                        { ...inputOf(source), enabled: !source.enabled },
                        source.id,
                      ),
                    source.enabled
                      ? "Publishing paused."
                      : "Publishing resumed.",
                  )
                }
              >
                {source.enabled ? "Pause" : "Resume"}
              </button>
              <button
                disabled={busy}
                className={`${button} text-red-600`}
                onClick={() => {
                  if (
                    window.confirm(
                      "Delete this RSS source? Existing posts will stay.",
                    )
                  )
                    void mutate(async () => {
                      await deleteRssSource(source.id);
                      if (editing === source.id) {
                        setEditing(undefined);
                        setForm(empty);
                      }
                    }, "Source deleted.");
                }}
              >
                Delete
              </button>
            </div>
          </article>
        ))
      )}
    </div>
  );
}
