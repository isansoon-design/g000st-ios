import { RTCView } from '@livekit/react-native-webrtc';
import { Image } from 'expo-image';
import { memo } from 'react';
import { ImageBackground, Modal, Pressable, Text, View } from 'react-native';

import type { CallUiState } from '@/features/calling/call-manager';

type CallOverlayProps = Readonly<{
  state: CallUiState;
  onAnswer: () => void;
  onDecline: () => void;
  onHangUp: () => void;
  onToggleMute: () => void;
  onToggleCamera: () => void;
  peerProfile: Readonly<{ displayName?: string; avatarUrl?: string }> | null;
}>;

function shortId(publicId: string): string {
  return `${publicId.slice(0, 12)}…${publicId.slice(-6)}`;
}

function initials(displayName: string | undefined): string {
  const value = displayName?.trim();
  if (!value) return '◎';
  return value
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

function RoundButton({
  accessibilityLabel,
  label,
  color,
  foreground = '#FFFFFF',
  onPress,
}: Readonly<{
  accessibilityLabel: string;
  label: string;
  color: string;
  foreground?: string;
  onPress: () => void;
}>) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      className="h-16 w-16 items-center justify-center rounded-full active:opacity-80"
      style={{ backgroundColor: color }}
      onPress={onPress}
    >
      <Text className="text-xl font-black" style={{ color: foreground }}>
        {label}
      </Text>
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
  peerProfile,
}: CallOverlayProps) {
  if (state.phase === 'idle') return null;

  const displayName = peerProfile?.displayName || state.peerDisplayName;
  const avatarUrl = peerProfile?.avatarUrl;
  const hasRemoteVideo = state.phase === 'in-call' && state.media === 'video' && state.remoteStreamUrl;

  return (
    <Modal animationType="fade" transparent visible>
      <View className="flex-1 overflow-hidden bg-[#090909]">
        {avatarUrl && !hasRemoteVideo ? (
          <ImageBackground
            blurRadius={28}
            resizeMode="cover"
            source={{ uri: avatarUrl }}
            style={{ position: 'absolute', inset: 0, transform: [{ scale: 1.15 }] }}
          >
            <View className="flex-1 bg-black/65" />
          </ImageBackground>
        ) : null}

        {hasRemoteVideo ? (
          <RTCView objectFit="cover" streamURL={state.remoteStreamUrl} style={{ flex: 1 }} />
        ) : null}

        <View className="absolute inset-0 items-center justify-between px-6 py-16">
          <View className="items-center gap-2">
            <Text className="text-center text-lg font-black text-white" numberOfLines={1}>
              {displayName || shortId(state.peerPublicId)}
            </Text>
            <Text className="text-sm font-bold text-white/60">
              {state.phase === 'ringing-outgoing' && 'Calling…'}
              {state.phase === 'ringing-incoming' && (state.media === 'video' ? 'Incoming video call' : 'Incoming call')}
              {state.phase === 'connecting' && 'Connecting…'}
              {state.phase === 'in-call' && (state.media === 'video' ? 'Video call' : 'Voice call')}
            </Text>
          </View>

          {!hasRemoteVideo ? (
            <View className="h-40 w-40 items-center justify-center overflow-hidden rounded-full border-2 border-white/30 bg-white/10 shadow-2xl">
              {avatarUrl ? (
                <Image contentFit="cover" source={{ uri: avatarUrl }} style={{ height: '100%', width: '100%' }} />
              ) : (
                <Text className="text-5xl font-black text-white/80">{initials(displayName)}</Text>
              )}
            </View>
          ) : (
            <View />
          )}

          {state.phase === 'ringing-incoming' ? (
            <View className="w-full flex-row items-center justify-center gap-10">
              <RoundButton accessibilityLabel="Decline call" color="#E5484D" label="✕" onPress={onDecline} />
              <RoundButton accessibilityLabel="Answer call" color="#30A46C" label="✓" onPress={onAnswer} />
            </View>
          ) : (
            <View className="w-full flex-row items-center justify-center gap-6">
              {state.phase === 'in-call' ? (
                <>
                  <RoundButton
                    accessibilityLabel={state.isMuted ? 'Unmute microphone' : 'Mute microphone'}
                    color={state.isMuted ? '#FFFFFF' : 'rgba(255,255,255,0.25)'}
                    foreground={state.isMuted ? '#111111' : '#FFFFFF'}
                    label={state.isMuted ? '🔇' : '🎙'}
                    onPress={onToggleMute}
                  />
                  {state.media === 'video' ? (
                    <RoundButton
                      accessibilityLabel={state.isCameraOn ? 'Turn camera off' : 'Turn camera on'}
                      color={state.isCameraOn ? 'rgba(255,255,255,0.25)' : '#FFFFFF'}
                      foreground={state.isCameraOn ? '#FFFFFF' : '#111111'}
                      label="📷"
                      onPress={onToggleCamera}
                    />
                  ) : null}
                </>
              ) : null}
              <RoundButton accessibilityLabel="End call" color="#E5484D" label="✕" onPress={onHangUp} />
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

export const CallOverlay = memo(CallOverlayComponent);
