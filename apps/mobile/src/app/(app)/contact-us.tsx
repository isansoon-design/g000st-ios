import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { chatConversationsQueryKey } from '@/features/chat/query-keys';
import { router } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { z } from 'zod';
import axios from '@/api/axios';
import { parseApiPayload } from '@/api/parse-api-payload';
import { FeatureScreen } from '@/components/layout/feature-screen';
import { useAppTheme } from '@/theme/app-theme';

const supportConversationSchema = z.object({ version: z.literal(1), conversationId: z.string().min(1) });

export default function ContactUsScreen() {
  const { colors } = useAppTheme();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const opening = useRef(false);

  async function openSupport() {
    if (opening.current) return;
    opening.current = true;
    setBusy(true);
    setError('');
    try {
      const response = await axios.post('/communication/support/conversation');
      const { conversationId } = parseApiPayload(supportConversationSchema, response.data);
      await queryClient.invalidateQueries({ queryKey: chatConversationsQueryKey });
      router.push({ pathname: '/(app)/(tabs)/chat/[conversationId]', params: { conversationId } });
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not open support. Please try again.');
    } finally {
      opening.current = false;
      setBusy(false);
    }
  }

  return <FeatureScreen title="Contact us">
    <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }}>
      <View className="rounded-3xl border p-6" style={{ backgroundColor: colors.card, borderColor: colors.border }}>
        <Text className="text-center text-2xl font-black" style={{ color: colors.text }}>We’re here to help</Text>
        <Text className="mt-3 text-center text-sm leading-6" style={{ color: colors.muted }}>Need help or want to report a complaint? Start a private conversation with our support team.</Text>
        <Pressable accessibilityRole="button" accessibilityState={{ disabled: busy, busy }} disabled={busy} onPress={() => void openSupport()} className="mt-6 rounded-xl bg-g000st-red px-4 py-4" style={{ opacity: busy ? 0.5 : 1 }}>
          {busy ? <ActivityIndicator color="white" /> : <Text className="text-center font-bold text-white">Contact us & report a complaint</Text>}
        </Pressable>
        {!!error && <Text accessibilityRole="alert" className="mt-4 text-center text-sm" style={{ color: colors.text }}>{error}</Text>}
      </View>
    </ScrollView>
  </FeatureScreen>;
}
