import '@/global.css';

import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { initialWindowMetrics, SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider } from '@/features/auth/context/auth-provider';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { CallOverlayHost } from '@/features/calling/components/call-overlay-host';
import { ConfirmModalProvider } from '@/providers/confirm-modal-provider';
import { QueryProvider } from '@/providers/query-provider';
import { CallingBootstrap } from '@/services/calling/calling-bootstrap';
import { NotificationsBootstrap } from '@/services/notifications/notifications-bootstrap';
import { PresenceHeartbeat } from '@/services/presence/presence-heartbeat';
import Toast from 'react-native-toast-message';

void SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { status } = useAuth();

  useEffect(() => {
    if (status !== 'loading') void SplashScreen.hideAsync();
  }, [status]);

  if (status === 'loading') return <View className="flex-1 bg-g000st-metal" />;

  return <Stack screenOptions={{ headerShown: false }} />;
}

export default function RootLayout() {
  return (
    <>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider initialMetrics={initialWindowMetrics}>
          <KeyboardProvider>
            <QueryProvider>
              <AuthProvider>
                <ConfirmModalProvider>
                  <NotificationsBootstrap />
                  <PresenceHeartbeat />
                  <CallingBootstrap />
                  <RootNavigator />
                  <CallOverlayHost />
                </ConfirmModalProvider>
              </AuthProvider>
            </QueryProvider>
          </KeyboardProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
      <Toast />
    </>
  );
}
