import { memo } from 'react';
import { Pressable, Text, View } from 'react-native';

import { G000stWordmark } from '@/components/brand/g000st-wordmark';
import { FeatureScreen } from '@/components/layout/feature-screen';
import type { Balance, BillingSku, OutboundSms } from '@/domain/mobile/types';
import { ExternalCallOverlay } from '@/features/mobile/components/external-call-overlay';
import { PlansModal } from '@/features/mobile/components/plans-modal';
import { SmsComposerModal } from '@/features/mobile/components/sms-composer-modal';
import type { ExternalCallStatus } from '@/features/mobile/hooks/use-mobile-external-call';

const DIAL_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'] as const;

type MobileScreenContentProps = Readonly<{
  balance: Balance | null;
  buying: boolean;
  callDurationSec: number;
  callStatus: ExternalCallStatus;
  dialValue: string;
  isCallActionDisabled: boolean;
  isMuted: boolean;
  isPlansOpen: boolean;
  isSmsOpen: boolean;
  onBackspace: () => void;
  onBuy: () => void;
  onCall: () => void;
  onCallClose: () => void;
  onChangeSmsBody: (value: string) => void;
  onChangeSmsTo: (value: string) => void;
  onClosePlans: () => void;
  onCloseSms: () => void;
  onHangUp: () => void;
  onOpenPlans: () => void;
  onOpenSms: () => void;
  onPressDigit: (digit: string) => void;
  onSelectSku: (skuId: string) => void;
  onSend: () => void;
  onToggleMute: () => void;
  selectedSkuId: string | null;
  skus: readonly BillingSku[];
  skusLoading: boolean;
  smsBody: string;
  smsHistory: readonly OutboundSms[];
  smsHistoryLoading: boolean;
  smsSending: boolean;
  smsTo: string;
}>;

function MobileScreenContentComponent({
  balance,
  buying,
  callDurationSec,
  callStatus,
  dialValue,
  isCallActionDisabled,
  isMuted,
  isPlansOpen,
  isSmsOpen,
  onBackspace,
  onBuy,
  onCall,
  onCallClose,
  onChangeSmsBody,
  onChangeSmsTo,
  onClosePlans,
  onCloseSms,
  onHangUp,
  onOpenPlans,
  onOpenSms,
  onPressDigit,
  onSelectSku,
  onSend,
  onToggleMute,
  selectedSkuId,
  skus,
  skusLoading,
  smsBody,
  smsHistory,
  smsHistoryLoading,
  smsSending,
  smsTo,
}: MobileScreenContentProps) {
  const dialDisplay = dialValue || 'g000st';
  return (
    <FeatureScreen
      rightAction={
        <Pressable
          accessibilityLabel="Buy credit"
          accessibilityRole="button"
          className="h-9 w-9 items-center justify-center rounded-full border border-black/15 bg-white"
          onPress={onOpenPlans}
        >
          <Text className="text-base font-black text-g000st-black">£</Text>
        </Pressable>
      }
      title="g000st Mobile"
    >
      <View className="flex-1 px-5 py-4">
        {dialValue ? <Text className="text-center text-[34px] font-black tracking-[2px] text-g000st-black">{dialValue}</Text> : <G000stWordmark className="text-center text-[34px] tracking-[2px]" />}
        <Text className="mt-1 text-center text-[10px] font-black tracking-[1px] text-black/45">
          PRIVATE NUMBER · NO RECORDING
        </Text>
        <Text className="mb-3 mt-1 text-center text-xs font-extrabold text-[#333333]">
          {balance ? `${Math.floor(balance.voiceSecondsRemaining / 60)} min · ${balance.smsRemaining} SMS` : 'No credit'}
        </Text>

        <View className="mx-auto w-full max-w-[300px] flex-row flex-wrap justify-center gap-3">
          {DIAL_KEYS.map((digit) => (
            <Pressable
              accessibilityLabel={`Dial ${digit}`}
              accessibilityRole="button"
              className="h-[62px] w-[82px] items-center justify-center rounded-[20px] border border-black/15 bg-white active:bg-[#EEEEEE]"
              key={digit}
              onPress={() => onPressDigit(digit)}
            >
              <Text className="text-[24px] font-black text-g000st-black">{digit}</Text>
            </Pressable>
          ))}
        </View>

        <Pressable
          accessibilityLabel="Buy credit"
          accessibilityRole="button"
          className="mx-auto mt-4 h-11 w-full max-w-[300px] items-center justify-center rounded-full bg-g000st-black active:opacity-80"
          onPress={onOpenPlans}
        >
          <Text className="text-sm font-black text-white">Buy</Text>
        </Pressable>

        <View className="mx-auto mt-4 w-full max-w-[300px] flex-row items-center justify-between">
          <Pressable
            accessibilityLabel="Send SMS"
            accessibilityRole="button"
            className="h-12 flex-1 items-center justify-center rounded-full active:bg-black/5"
            onPress={onOpenSms}
          >
            <Text className="font-black text-g000st-silver">SMS</Text>
          </Pressable>
          <Pressable
            accessibilityLabel="Call"
            accessibilityRole="button"
            className={`mx-3 h-16 w-16 items-center justify-center rounded-full bg-[#34C759] ${
              isCallActionDisabled ? 'opacity-50' : ''
            }`}
            disabled={isCallActionDisabled}
            onPress={onCall}
          >
            <Text className="text-xs font-black text-white">CALL</Text>
          </Pressable>
          <Pressable
            accessibilityLabel="Delete digit"
            accessibilityRole="button"
            className="h-12 flex-1 items-center justify-center rounded-full active:bg-black/5"
            onPress={onBackspace}
          >
            <Text className="text-xl font-black text-g000st-black">⌫</Text>
          </Pressable>
        </View>

        <Text className="mt-5 text-center text-xs font-semibold text-black/45">
          Calls and SMS go through g000st Mobile — no personal number is shared.
        </Text>
      </View>

      <SmsComposerModal
        history={smsHistory}
        historyLoading={smsHistoryLoading}
        isOpen={isSmsOpen}
        onChangeBody={onChangeSmsBody}
        onChangeTo={onChangeSmsTo}
        onClose={onCloseSms}
        onSend={onSend}
        sending={smsSending}
        smsBody={smsBody}
        smsTo={smsTo}
      />

      <PlansModal
        buying={buying}
        isOpen={isPlansOpen}
        onBuy={onBuy}
        onClose={onClosePlans}
        onSelect={onSelectSku}
        selectedSkuId={selectedSkuId}
        skus={skus}
        skusLoading={skusLoading}
      />

      <ExternalCallOverlay
        callDurationSec={callDurationSec}
        dialDisplay={dialDisplay}
        isMuted={isMuted}
        onClose={onCallClose}
        onHangUp={onHangUp}
        onToggleMute={onToggleMute}
        status={callStatus}
      />
    </FeatureScreen>
  );
}

export const MobileScreenContent = memo(MobileScreenContentComponent);
