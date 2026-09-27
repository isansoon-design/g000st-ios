import { memo } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';

import type { BillingSku } from '@/domain/mobile/types';

const SKU_ICON: Record<string, string> = { sms: '💬', voice_minutes: '📞' };

function formatPrice(priceCents: number, currency: string): string {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(priceCents / 100);
}

type PlansModalProps = Readonly<{
  buying: boolean;
  isOpen: boolean;
  onBuy: () => void;
  onClose: () => void;
  onSelect: (skuId: string) => void;
  selectedSkuId: string | null;
  skus: readonly BillingSku[];
  skusLoading: boolean;
}>;

function PlansModalComponent({
  buying,
  isOpen,
  onBuy,
  onClose,
  onSelect,
  selectedSkuId,
  skus,
  skusLoading,
}: PlansModalProps) {
  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible={isOpen}>
      <View style={{ alignItems: 'center', backgroundColor: 'rgba(0, 0, 0, 0.5)', flex: 1, justifyContent: 'center', paddingHorizontal: 20 }}>
        <View className="w-full max-w-[380px] rounded-[24px] border border-white/60 dark:border-white/20 bg-[#D8D8D8] dark:bg-night-canvas p-5">
          <Text className="mb-3 text-lg font-black text-g000st-black dark:text-night-text">Buy credit</Text>

          {skusLoading ? (
            <Text className="py-6 text-center text-xs text-black/45 dark:text-night-muted">Loading…</Text>
          ) : (
            <ScrollView className="max-h-[320px]">
              {skus.map((sku) => (
                <Pressable
                  accessibilityRole="button"
                  className={`mb-2.5 flex-row items-center gap-3 rounded-[18px] border p-4 ${
                    selectedSkuId === sku.id ? 'border-[2.5px] border-g000st-red bg-[#ffe8e8] dark:bg-night-softred' : 'border-black/10 dark:border-night-border bg-white dark:bg-night-surface'
                  }`}
                  key={sku.id}
                  onPress={() => onSelect(sku.id)}
                >
                  <Text className="text-xl text-g000st-red">{SKU_ICON[sku.kind] ?? '•'}</Text>
                  <View className="flex-1">
                    <Text className="text-[15px] font-black text-g000st-black dark:text-night-text">{sku.label}</Text>
                    <Text className="text-[11px] text-black/50 dark:text-night-muted">
                      {sku.kind === 'voice_minutes' ? 'Mobile voice' : 'UK / EU / USA'}
                    </Text>
                  </View>
                  <Text className="text-lg font-black text-g000st-black dark:text-night-text">{formatPrice(sku.priceCents, sku.currency)}</Text>
                </Pressable>
              ))}
            </ScrollView>
          )}

          <Pressable
            accessibilityRole="button"
            className={`mt-2 h-12 items-center justify-center rounded-full bg-black ${
              buying || !selectedSkuId ? 'opacity-50' : ''
            }`}
            disabled={buying || !selectedSkuId}
            onPress={onBuy}
          >
            <Text className="font-black text-white">{buying ? 'Redirecting…' : 'Buy'}</Text>
          </Pressable>
          <Text className="mt-2 text-center text-[10px] text-black/45 dark:text-night-muted">Card, Apple Pay, or Google Pay on the next screen</Text>

          <Pressable
            accessibilityRole="button"
            className="mt-3 h-11 items-center justify-center rounded-full border border-black/15 dark:border-night-border bg-white dark:bg-night-surface"
            onPress={onClose}
          >
            <Text className="font-bold text-g000st-black dark:text-night-text">Close</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

export const PlansModal = memo(PlansModalComponent);
