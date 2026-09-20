import axiosInstance from '@/api/axios';

export async function sendHeartbeat() {
  await axiosInstance.post('/presence/heartbeat');
}
