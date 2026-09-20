import axios from "./axios";

export async function sendHeartbeat(): Promise<void> {
  await axios.post("/presence/heartbeat");
}
