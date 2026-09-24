import { Host, Text } from '@expo/ui/jetpack-compose';
import { blur } from '@expo/ui/jetpack-compose/modifiers';

type BlurredMessageTextProps = Readonly<{
  blurred: boolean;
  content: string;
  mine: boolean;
}>;

export function BlurredMessageText({ blurred, content, mine }: BlurredMessageTextProps) {
  return (
    <Host matchContents pointerEvents="none">
      <Text
        color={mine ? '#111111' : '#FFFFFF'}
        modifiers={blurred ? [blur(7)] : []}
        style={{ fontSize: 14, fontWeight: 'bold', lineHeight: 20 }}
      >
        {content}
      </Text>
    </Host>
  );
}
