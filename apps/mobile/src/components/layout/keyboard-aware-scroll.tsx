import { type ComponentType } from 'react';
import {
  KeyboardAwareScrollView,
  type KeyboardAwareScrollViewProps,
} from 'react-native-keyboard-controller';
import { remapProps } from 'nativewind';

type NativeWindKeyboardAwareScrollProps = KeyboardAwareScrollViewProps &
  Readonly<{
    className?: string;
    contentContainerClassName?: string;
  }>;

remapProps(KeyboardAwareScrollView, {
  className: 'style',
  contentContainerClassName: 'contentContainerStyle',
});

export const KeyboardAwareScroll = KeyboardAwareScrollView as ComponentType<
  NativeWindKeyboardAwareScrollProps
>;
