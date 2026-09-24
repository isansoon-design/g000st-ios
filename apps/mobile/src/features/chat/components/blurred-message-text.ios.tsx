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
  mine: boolean;
}>;

export function BlurredMessageText({ blurred, content, mine }: BlurredMessageTextProps) {
  return (
    <Host matchContents pointerEvents="none">
      <Text
        modifiers={[
          font({ size: 14, weight: 'bold' }),
          foregroundStyle(mine ? '#111111' : '#FFFFFF'),
          lineHeight(20),
          multilineTextAlignment('leading'),
          ...(blurred ? [blur(7)] : []),
        ]}
      >
        {content}
      </Text>
    </Host>
  );
}
