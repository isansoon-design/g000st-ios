export type CallMedia = "audio" | "video";

export type TurnCredential = {
  urls: string[];
  username: string;
  credential: string;
  expiresAtMs: number;
};

export type CallHistoryEntry = {
  id: string;
  callerPublicId: string;
  calleePublicId: string;
  media: CallMedia;
  status: "ringing" | "in_progress" | "ended" | "missed" | "rejected";
  startedAtMs: number;
  answeredAtMs?: number;
  endedAtMs?: number;
};
