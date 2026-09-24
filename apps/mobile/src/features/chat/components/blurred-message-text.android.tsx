import { Host, Text } from '@expo/ui/jetpack-compose';
import { blur } from '@expo/ui/jetpack-compose/modifiers';

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
        color={mine ? '#111111' : '#FFFFFF'}
        modifiers={blurred ? [blur(7)] : []}
        style={{ fontSize, fontWeight: 'bold', lineHeight: Math.round(fontSize * 1.4) }}
      >
        {content}
      </Text>
    </Host>
  );
}
