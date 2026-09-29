import { Redirect, Slot } from 'expo-router';

import { useAuth } from '@/features/auth/hooks/use-auth';
import { AppSidebarProvider } from '@/components/navigation/app-sidebar';

export default function AuthenticatedLayout() {
  const { status } = useAuth();

  if (status !== 'authenticated') return <Redirect href="/" />;
  return <AppSidebarProvider><Slot /></AppSidebarProvider>;
}
