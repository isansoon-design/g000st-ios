import { Redirect, Slot } from 'expo-router';

import { useAuth } from '@/features/auth/hooks/use-auth';

export default function AuthenticatedLayout() {
  const { status } = useAuth();

  if (status !== 'authenticated') return <Redirect href="/" />;
  return <Slot />;
}
