import { RTCView } from '@livekit/react-native-webrtc';
import { memo } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';

import type { CallUiState } from '@/features/calling/call-manager';

type CallOverlayProps = Readonly<{
  state: CallUiState;
  onAnswer: () => void;
  onDecline: () => void;
  onHangUp: () => void;
  onToggleMute: () => void;
  onToggleCamera: () => void;
}>;

function PeerLabel({ peerPublicId }: Readonly<{ peerPublicId: string }>) {
  return (
    <Text className="text-center text-lg font-black text-white" numberOfLines={1}>
      {peerPublicId.slice(0, 12)}
    </Text>
  );
}

function RoundButton({
  label,
  color,
  onPress,
}: Readonly<{ label: string; color: string; onPress: () => void }>) {
  return (
    <Pressable
      accessibilityRole="button"
      className="h-16 w-16 items-center justify-center rounded-full active:opacity-80"
      style={{ backgroundColor: color }}
      onPress={onPress}
    >
      <Text className="text-xl font-black text-white">{label}</Text>
    </Pressable>
  );
}

function CallOverlayComponent({
  state,
  onAnswer,
  onDecline,
  onHangUp,
  onToggleMute,
  onToggleCamera,
}: CallOverlayProps) {
  if (state.phase === 'idle') return null;

  return (
    <Modal animationType="fade" transparent visible>
      <View className="flex-1 bg-black">
        {state.phase === 'in-call' && state.remoteStreamUrl ? (
          <RTCView objectFit="cover" streamURL={state.remoteStreamUrl} style={{ flex: 1 }} />
        ) : null}

        <View className="absolute inset-0 items-center justify-between px-6 py-16">
          <View className="items-center gap-2">
            <PeerLabel peerPublicId={state.peerPublicId} />
            <Text className="text-sm font-bold text-white/60">
              {state.phase === 'ringing-outgoing' && 'Calling…'}
              {state.phase === 'ringing-incoming' && (state.media === 'video' ? 'Incoming video call' : 'Incoming call')}
              {state.phase === 'connecting' && 'Connecting…'}
              {state.phase === 'in-call' && (state.media === 'video' ? 'Video call' : 'Voice call')}
            </Text>
          </View>

          {state.phase === 'ringing-incoming' ? (
            <View className="w-full flex-row items-center justify-center gap-10">
              <RoundButton color="#E5484D" label="✕" onPress={onDecline} />
              <RoundButton color="#30A46C" label="✓" onPress={onAnswer} />
            </View>
          ) : (
            <View className="w-full flex-row items-center justify-center gap-6">
              {state.phase === 'in-call' ? (
                <>
                  <RoundButton
                    color={state.isMuted ? '#FFFFFF' : 'rgba(255,255,255,0.25)'}
                    label={state.isMuted ? '🔇' : '🎙'}
                    onPress={onToggleMute}
                  />
                  {state.media === 'video' ? (
                    <RoundButton
                      color={state.isCameraOn ? 'rgba(255,255,255,0.25)' : '#FFFFFF'}
                      label="📷"
                      onPress={onToggleCamera}
                    />
                  ) : null}
                </>
              ) : null}
              <RoundButton color="#E5484D" label="✕" onPress={onHangUp} />
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

export const CallOverlay = memo(CallOverlayComponent);
