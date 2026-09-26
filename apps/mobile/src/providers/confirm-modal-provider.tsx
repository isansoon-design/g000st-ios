import { createContext, ReactNode, useCallback, useContext, useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';

export interface ConfirmModalOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDangerous?: boolean; // For deletion confirmations
}

interface ConfirmModalContextType {
  isOpen: boolean;
  options: ConfirmModalOptions | null;
  confirm: (options: ConfirmModalOptions) => Promise<boolean>;
}

const ConfirmModalContext = createContext<ConfirmModalContextType | undefined>(undefined);

export function ConfirmModalProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<ConfirmModalOptions | null>(null);
  const [resolvePromise, setResolvePromise] = useState<((value: boolean) => void) | null>(null);

  const confirm = useCallback((opts: ConfirmModalOptions) => {
    return new Promise<boolean>((resolve) => {
      setOptions(opts);
      setIsOpen(true);
      setResolvePromise(() => resolve);
    });
  }, []);

  const handleConfirm = useCallback(() => {
    if (resolvePromise) resolvePromise(true);
    setIsOpen(false);
    setOptions(null);
    setResolvePromise(null);
  }, [resolvePromise]);

  const handleCancel = useCallback(() => {
    if (resolvePromise) resolvePromise(false);
    setIsOpen(false);
    setOptions(null);
    setResolvePromise(null);
  }, [resolvePromise]);

  return (
    <ConfirmModalContext.Provider value={{ isOpen, options, confirm }}>
      {children}
      <Modal animationType="fade" transparent visible={isOpen} onRequestClose={handleCancel}>
        <View className="flex-1 items-center justify-center bg-black/50 px-4">
          <View className="w-full max-w-sm rounded-lg bg-white p-6 shadow-lg">
            {options && (
              <>
                <Text className="mb-4 text-lg font-semibold text-gray-900">{options.title}</Text>
                <Text className="mb-6 text-gray-600">{options.message}</Text>
                <View className="flex-row justify-end gap-3">
                  <Pressable
                    onPress={handleCancel}
                    className="rounded-lg bg-gray-100 px-4 py-2"
                  >
                    <Text className="font-medium text-gray-700">{options.cancelLabel || 'Cancel'}</Text>
                  </Pressable>
                  <Pressable
                    onPress={handleConfirm}
                    className={`rounded-lg px-4 py-2 ${
                      options.isDangerous ? 'bg-red-600' : 'bg-blue-600'
                    }`}
                  >
                    <Text className="font-medium text-white">{options.confirmLabel || 'Confirm'}</Text>
                  </Pressable>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </ConfirmModalContext.Provider>
  );
}

export function useConfirmModal() {
  const context = useContext(ConfirmModalContext);
  if (!context) {
    throw new Error('useConfirmModal must be used within ConfirmModalProvider');
  }
  return context;
}
