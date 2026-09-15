import { type PropsWithChildren, type ReactNode } from 'react';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type FeatureScreenProps = PropsWithChildren<
  Readonly<{
    rightAction?: ReactNode;
    title: ReactNode;
  }>
>;

export function FeatureScreen({ children, rightAction, title }: FeatureScreenProps) {
  const insets = useSafeAreaInsets();

  return (
    <View className="flex-1 bg-[#D8D8D8]" style={{ paddingTop: insets.top }}>
      <View className="h-14 flex-row items-center justify-between border-b border-black/15 bg-[#D2D2D2] px-3 pt-1">
        {typeof title === 'string' ? (
          <Text className="text-[15px] font-black text-g000st-black">{title}</Text>
        ) : (
          title
        )}
        {rightAction}
      </View>
      {children}
    </View>
  );
}
