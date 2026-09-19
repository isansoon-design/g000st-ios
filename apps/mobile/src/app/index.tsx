import { Redirect } from 'expo-router';

import { useAuth } from '@/features/auth/hooks/use-auth';
import { IdGateScreen } from '@/features/auth/screens/id-gate-screen';

export default function IndexRoute() {
  const { status } = useAuth();

  if (status === 'authenticated') return <Redirect href="/(app)/(tabs)/social" />;
  return <IdGateScreen />;
}
