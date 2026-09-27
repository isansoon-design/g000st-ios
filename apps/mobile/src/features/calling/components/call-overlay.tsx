import { RTCView } from '@livekit/react-native-webrtc';
import { Image } from 'expo-image';
import { memo, useEffect, useState } from 'react';
import { ImageBackground, Modal, Pressable, Text, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { clamp, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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

type ViewportSize = Readonly<{ width: number; height: number }>;

const PREVIEW_WIDTH = 112;
const PREVIEW_HEIGHT = 160;

function DraggableLocalPreview({ streamURL, viewport }: Readonly<{ streamURL: string; viewport: ViewportSize }>) {
  const insets = useSafeAreaInsets();
  const availableX = Math.max(0, viewport.width - PREVIEW_WIDTH);
  const availableY = Math.max(0, viewport.height - PREVIEW_HEIGHT);
  const minX = Math.min(Math.max(12, insets.left + 8), availableX);
  const maxX = Math.max(minX, availableX - Math.max(12, insets.right + 8));
  const minY = Math.min(Math.max(12, insets.top + 8), availableY);
  const bottomClearance = Math.max(insets.bottom + 96, Math.min(180, Math.max(96, viewport.height * 0.2)));
  const maxY = Math.max(minY, availableY - bottomClearance);

  const x = useSharedValue(clamp(availableX - 20, minX, maxX));
  const y = useSharedValue(clamp(availableY - 180, minY, maxY));
  const dragStartX = useSharedValue(0);
  const dragStartY = useSharedValue(0);

  useEffect(() => {
    x.set((current) => clamp(current, minX, maxX));
    y.set((current) => clamp(current, minY, maxY));
  }, [maxX, maxY, minX, minY, x, y]);

  const pan = Gesture.Pan()
    .minDistance(2)
    .onStart(() => {
      dragStartX.set(x.get());
      dragStartY.set(y.get());
    })
    .onUpdate((event) => {
      x.set(clamp(dragStartX.get() + event.translationX, minX, maxX));
      y.set(clamp(dragStartY.get() + event.translationY, minY, maxY));
    });

  const positionStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: x.get() }, { translateY: y.get() }],
  }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View
        accessibilityLabel="Move camera preview"
        collapsable={false}
        pointerEvents="box-only"
        style={[
          {
            position: 'absolute',
            left: 0,
            top: 0,
            width: PREVIEW_WIDTH,
            height: PREVIEW_HEIGHT,
            zIndex: 20,
            elevation: 20,
            backgroundColor: '#000000',
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.3)',
          },
          positionStyle,
        ]}
      >
        <RTCView mirror objectFit="cover" pointerEvents="none" streamURL={streamURL} style={{ flex: 1 }} zOrder={2} />
      </Animated.View>
    </GestureDetector>
  );
}

function shortId(publicId: string): string {
  return publicId.slice(0, 8);
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

function CallDuration({ answeredAtMs }: Readonly<{ answeredAtMs: number }>) {
  const [now, setNow] = useState(Date.now);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, [answeredAtMs]);

  const totalSeconds = Math.max(0, Math.floor((now - answeredAtMs) / 1_000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const duration = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  return <Text className="text-sm font-bold text-white/70">{duration}</Text>;
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
  const [viewport, setViewport] = useState<ViewportSize>({ width: 0, height: 0 });
  if (state.phase === 'idle') return null;

  const displayName = peerProfile?.displayName || state.peerDisplayName;
  const avatarUrl = peerProfile?.avatarUrl;
  const hasRemoteVideo = state.phase === 'in-call' && state.media === 'video' && state.remoteStreamUrl;

  return (
    <Modal animationType="fade" transparent visible>
      <GestureHandlerRootView
        style={{ flex: 1, overflow: 'hidden', backgroundColor: '#090909' }}
        onLayout={(event) => {
          const { width, height } = event.nativeEvent.layout;
          setViewport((current) =>
            current.width === width && current.height === height ? current : { width, height },
          );
        }}
      >
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
          <RTCView objectFit="cover" streamURL={state.remoteStreamUrl} style={{ flex: 1 }} zOrder={0} />
        ) : null}

        <View className="absolute inset-0 items-center justify-between px-6 py-16">
          <View className="items-center gap-2">
            <Text className="text-center text-lg font-black text-white" numberOfLines={1}>
              {displayName || shortId(state.peerPublicId)}
            </Text>
            {state.phase === 'in-call' ? <CallDuration answeredAtMs={state.answeredAtMs} /> : null}
            <Text className="text-sm font-bold text-white/60">
              {state.phase === 'ringing-outgoing' && 'Calling…'}
              {state.phase === 'ringing-incoming' && (state.media === 'video' ? 'Incoming video call' : 'Incoming call')}
              {state.phase === 'connecting' && 'Connecting…'}
              {state.phase === 'in-call' && (state.media === 'video' ? 'Video call' : 'Voice call')}
            </Text>
          </View>

          {!hasRemoteVideo ? (
            <View className="h-40 w-40 items-center justify-center overflow-hidden rounded-full border-2 border-white/30 dark:border-white/20 bg-white/10 shadow-2xl">
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

        {(state.phase === 'in-call' || state.phase === 'ringing-outgoing') &&
        state.media === 'video' &&
        (state.phase !== 'in-call' || state.isCameraOn) &&
        state.localStreamUrl && viewport.width > 0 && viewport.height > 0 ? (
          <DraggableLocalPreview streamURL={state.localStreamUrl} viewport={viewport} />
        ) : null}
      </GestureHandlerRootView>
    </Modal>
  );
}

export const CallOverlay = memo(CallOverlayComponent);
