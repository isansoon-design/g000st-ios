import { memo } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';

import type { ExternalCallStatus } from '@/features/mobile/hooks/use-mobile-external-call';

const STATUS_LABEL: Partial<Record<ExternalCallStatus, string>> = {
  connecting: 'Connecting…',
  ringing: 'Ringing…',
  active: 'In call',
  ended: 'Call ended',
};

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

type ExternalCallOverlayProps = Readonly<{
  callDurationSec: number;
  dialDisplay: string;
  isMuted: boolean;
  onClose: () => void;
  onHangUp: () => void;
  onToggleMute: () => void;
  status: ExternalCallStatus;
}>;

function ExternalCallOverlayComponent({
  callDurationSec,
  dialDisplay,
  isMuted,
  onClose,
  onHangUp,
  onToggleMute,
  status,
}: ExternalCallOverlayProps) {
  if (status === 'idle' || status === 'error') return null;

  const minutes = String(Math.floor(callDurationSec / 60)).padStart(2, '0');
  const seconds = String(callDurationSec % 60).padStart(2, '0');

  return (
    <Modal animationType="fade" transparent visible>
      <View className="flex-1 items-center justify-between bg-black/95 px-6 py-16">
        <View className="items-center gap-2">
          <Text className="text-xs font-black tracking-[1px] text-[#8FE39A]">{STATUS_LABEL[status]}</Text>
          <Text className="text-2xl font-black text-white">{dialDisplay}</Text>
          {status === 'active' ? (
            <Text className="text-sm font-semibold text-white/60">
              {minutes}:{seconds}
            </Text>
          ) : null}
        </View>

        {status === 'ended' ? (
          <Pressable
            accessibilityRole="button"
            className="h-12 items-center justify-center rounded-full border border-white/40 px-8"
            onPress={onClose}
          >
            <Text className="font-black text-white">Close</Text>
          </Pressable>
        ) : (
          <View className="w-full flex-row items-center justify-center gap-6">
            {status === 'active' ? (
              <RoundButton
                color={isMuted ? '#FFFFFF' : 'rgba(255,255,255,0.25)'}
                label={isMuted ? '🔇' : '🎙'}
                onPress={onToggleMute}
              />
            ) : null}
            <RoundButton color="#E5484D" label="✕" onPress={onHangUp} />
          </View>
        )}
      </View>
    </Modal>
  );
}

export const ExternalCallOverlay = memo(ExternalCallOverlayComponent);
