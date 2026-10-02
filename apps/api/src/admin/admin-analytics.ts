import type { Firestore } from "firebase-admin/firestore";
import { recentGeography } from '../presence/presence-geography.js';

export type AdminAnalyticsV1 = Readonly<{
  version: 1;
  generatedAtMs: number;
  timezone: "UTC";
  users: Readonly<{
    total: number;
    onlineNow: number;
    registeredToday: number;
    registeredThisMonth: number;
    activeToday: number;
    activeThisMonth: number;
    suspended: number;
    registrationsByDay: readonly Readonly<{ day: string; count: number }>[];
  }>;
  geography: Readonly<{
    source: "trusted_proxy" | "unavailable";
    coveredUsers: number;
    countries: readonly Readonly<{ name: string; count: number }>[];
    cities: readonly Readonly<{
      name: string;
      country: string;
      count: number;
    }>[];
  }>;
  sections: readonly Readonly<{
    key: string;
    label: string;
    count: number;
    today: number;
    thisMonth: number;
    metric: string;
  }>[];
}>;

type UserRecord = Readonly<{
  createdAtMs?: number;
  ownerPublicId?: string;
  status?: string;
}>;
type PresenceRecord = Readonly<{
  lastActiveAtMs?: number;
  country?: string;
  city?: string;
  geoRecordedAtMs?: number;
}>;

const ONLINE_WINDOW_MS = 2 * 60_000;

function sortedCounts(counts: Map<string, number>) {
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

export function summarizeUsers(
  users: readonly Readonly<{ id: string; data: UserRecord }>[],
  presence: ReadonlyMap<string, PresenceRecord>,
  nowMs: number,
) {
  const today = new Date(nowMs).toISOString().slice(0, 10);
  const month = today.slice(0, 7);
  const dayCounts = new Map<string, number>();
  for (let offset = 29; offset >= 0; offset -= 1) {
    dayCounts.set(
      new Date(Date.parse(`${today}T00:00:00.000Z`) - offset * 86_400_000)
        .toISOString()
        .slice(0, 10),
      0,
    );
  }
  let total = 0;
  let suspended = 0;
  let onlineNow = 0;
  let registeredToday = 0;
  let registeredThisMonth = 0;
  let activeToday = 0;
  let activeThisMonth = 0;
  let coveredUsers = 0;
  const countries = new Map<string, number>();
  const cities = new Map<string, number>();

  for (const user of users) {
    if (user.data.ownerPublicId || user.data.status === "deleted") continue;
    total += 1;
    if (user.data.status === "suspended") suspended += 1;
    if (
      typeof user.data.createdAtMs === "number" &&
      Number.isFinite(user.data.createdAtMs) &&
      user.data.createdAtMs >= 0 &&
      user.data.createdAtMs <= nowMs
    ) {
      const registeredDay = new Date(user.data.createdAtMs)
        .toISOString()
        .slice(0, 10);
      if (registeredDay === today) registeredToday += 1;
      if (registeredDay.startsWith(month)) registeredThisMonth += 1;
      if (dayCounts.has(registeredDay))
        dayCounts.set(registeredDay, dayCounts.get(registeredDay)! + 1);
    }
    if (user.data.status !== "active") continue;
    const seen = presence.get(user.id);
    if (
      !seen ||
      typeof seen.lastActiveAtMs !== "number" ||
      !Number.isFinite(seen.lastActiveAtMs) ||
      seen.lastActiveAtMs > nowMs
    )
      continue;
    if (
      nowMs - seen.lastActiveAtMs < ONLINE_WINDOW_MS &&
      seen.lastActiveAtMs <= nowMs
    )
      onlineNow += 1;
    const activeDay = new Date(seen.lastActiveAtMs).toISOString().slice(0, 10);
    if (activeDay === today) activeToday += 1;
    if (activeDay.startsWith(month)) activeThisMonth += 1;
    const geo = recentGeography(seen, nowMs);
    if (geo) {
      coveredUsers += 1;
      countries.set(geo.country, (countries.get(geo.country) ?? 0) + 1);
      if (geo.city) {
        const key = `${geo.country}\u0000${geo.city}`;
        cities.set(key, (cities.get(key) ?? 0) + 1);
      }
    }
  }

  return {
    users: {
      total,
      onlineNow,
      registeredToday,
      registeredThisMonth,
      activeToday,
      activeThisMonth,
      suspended,
      registrationsByDay: [...dayCounts].map(([day, count]) => ({
        day,
        count,
      })),
    },
    geography: {
      source: (coveredUsers ? "trusted_proxy" : "unavailable") as
        | "trusted_proxy"
        | "unavailable",
      coveredUsers,
      countries: sortedCounts(countries).map(([name, count]) => ({
        name,
        count,
      })),
      cities: sortedCounts(cities).map(([key, count]) => {
        const [country = "", name = ""] = key.split("\u0000");
        return { name, country, count };
      }),
    },
  };
}

export class AdminAnalyticsService {
  private cache:
    | Readonly<{ expiresAtMs: number; value: AdminAnalyticsV1 }>
    | undefined;
  constructor(
    private readonly db: Firestore,
    private readonly prefix: string,
    private readonly now: () => number = Date.now,
  ) {}

  private collection(name: string) {
    return this.db.collection(`${this.prefix}_${name}`);
  }

  async get(): Promise<AdminAnalyticsV1> {
    const nowMs = this.now();
    if (this.cache && nowMs < this.cache.expiresAtMs) return this.cache.value;
    const dayStart = Date.parse(
      `${new Date(nowMs).toISOString().slice(0, 10)}T00:00:00.000Z`,
    );
    const monthStart = Date.parse(
      `${new Date(nowMs).toISOString().slice(0, 7)}-01T00:00:00.000Z`,
    );
    const counts = [
      ["social", "Social", "social_posts", "createdAtMs", "posts"],
      ["market", "Market", "market_posts", "createdAtMs", "listings"],
      ["chat", "Chat", "chat_conversations", "createdAtMs", "conversations"],
      ["calling", "Calls", "calling_calls", "startedAtMs", "calls"],
      ["sms", "SMS", "telephony_sms", "createdAtMs", "messages"],
      ["profiles", "Profiles", "social_profiles", "updatedAtMs", "profiles"],
      [
        "social-reports",
        "Social reports",
        "social_reports",
        "createdAtMs",
        "reports",
      ],
      [
        "market-reports",
        "Market reports",
        "market_reports",
        "createdAtMs",
        "reports",
      ],
      ["support", "Support", "support_inbox", "createdAtMs", "messages"],
    ] as const;
    const [
      users,
      presence,
      sectionCounts,
      followTargets,
      externalCalls,
      ledgerEntries,
    ] = await Promise.all([
      this.collection("users")
        .select("createdAtMs", "ownerPublicId", "status")
        .get(),
      this.collection("presence")
        .select("lastActiveAtMs", "country", "city", "geoRecordedAtMs")
        .get(),
      Promise.all(
        counts.map(async ([key, label, collectionName, timeField, metric]) => {
          const collection = this.collection(collectionName);
          const [all, today, thisMonth] = await Promise.all([
            collection.count().get(),
            collection.where(timeField, ">=", dayStart).count().get(),
            collection.where(timeField, ">=", monthStart).count().get(),
          ]);
          return {
            key,
            label,
            metric,
            count: all.data().count,
            today: today.data().count,
            thisMonth: thisMonth.data().count,
          };
        }),
      ),
      this.db.collectionGroup("targets").select("createdAtMs").get(),
      this.db.collectionGroup("calls").select("startedAtMs").get(),
      this.db.collectionGroup("ledger").select("createdAtMs").get(),
    ]);
    const follows = followTargets.docs.filter((doc) =>
      doc.ref.path.startsWith(`${this.prefix}_social_camps/`),
    );
    const phoneCalls = externalCalls.docs.filter((doc) =>
      doc.ref.path.startsWith(`${this.prefix}_telephony_calls/`),
    );
    const ledger = ledgerEntries.docs.filter((doc) =>
      doc.ref.path.startsWith(`${this.prefix}_billing_balances/`),
    );
    const groupSection = (
      key: string,
      label: string,
      metric: string,
      docs: readonly { data(): FirebaseFirestore.DocumentData }[],
      field: string,
    ) => ({
      key,
      label,
      metric,
      count: docs.length,
      today: docs.filter(
        (doc) =>
          typeof doc.data()[field] === "number" &&
          doc.data()[field] >= dayStart,
      ).length,
      thisMonth: docs.filter(
        (doc) =>
          typeof doc.data()[field] === "number" &&
          doc.data()[field] >= monthStart,
      ).length,
    });
    const summary = summarizeUsers(
      users.docs.map((doc) => ({ id: doc.id, data: doc.data() as UserRecord })),
      new Map(
        presence.docs.map((doc) => [doc.id, doc.data() as PresenceRecord]),
      ),
      nowMs,
    );
    const value: AdminAnalyticsV1 = {
      version: 1,
      generatedAtMs: nowMs,
      timezone: "UTC",
      ...summary,
      sections: [
        ...sectionCounts,
        groupSection(
          "contacts",
          "Contacts",
          "follow relationships",
          follows,
          "createdAtMs",
        ),
        groupSection(
          "external-calls",
          "External calls",
          "calls",
          phoneCalls,
          "startedAtMs",
        ),
        groupSection(
          "billing",
          "Billing",
          "ledger entries",
          ledger,
          "createdAtMs",
        ),
      ],
    };
    this.cache = { expiresAtMs: nowMs + 60_000, value };
    return value;
  }
}
