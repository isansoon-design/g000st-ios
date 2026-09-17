import { type ComponentType } from 'react';
import {
  KeyboardAvoidingView as NativeKeyboardAvoidingView,
  type KeyboardAvoidingViewProps,
} from 'react-native-keyboard-controller';
import { remapProps } from 'nativewind';

type NativeWindKeyboardAvoidingViewProps = KeyboardAvoidingViewProps &
  Readonly<{ className?: string }>;

remapProps(NativeKeyboardAvoidingView, { className: 'style' });

export const KeyboardAvoidingView = NativeKeyboardAvoidingView as ComponentType<
  NativeWindKeyboardAvoidingViewProps
>;
