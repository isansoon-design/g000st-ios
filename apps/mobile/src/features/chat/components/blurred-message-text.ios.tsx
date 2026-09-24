import { Host, Text } from '@expo/ui/swift-ui';
import {
  blur,
  font,
  foregroundStyle,
  lineHeight,
  multilineTextAlignment,
} from '@expo/ui/swift-ui/modifiers';

type BlurredMessageTextProps = Readonly<{
  blurred: boolean;
  content: string;
  fontSize?: number;
  mine: boolean;
}>;

export function BlurredMessageText({
  blurred,
  content,
  fontSize = 14,
  mine,
}: BlurredMessageTextProps) {
  return (
    <Host matchContents pointerEvents="none">
      <Text
        modifiers={[
          font({ size: fontSize, weight: 'bold' }),
          foregroundStyle(mine ? '#111111' : '#FFFFFF'),
          lineHeight(Math.round(fontSize * 1.4)),
          multilineTextAlignment('leading'),
          ...(blurred ? [blur(7)] : []),
        ]}
      >
        {content}
      </Text>
    </Host>
  );
}
