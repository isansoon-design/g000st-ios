import { Host, Text } from '@expo/ui/jetpack-compose';
import { blur } from '@expo/ui/jetpack-compose/modifiers';
import { LinkifiedText } from "@/components/text/linkified-text";

type BlurredMessageTextProps = Readonly<{
  blurred: boolean;
  content: string;
  mine: boolean;
  fontSize?: number;
  maxWidth: number;
}>;

export function BlurredMessageText({
  blurred,
  content,
  fontSize = 14,
  maxWidth,
}: BlurredMessageTextProps) {
  if (!blurred) {
    return <LinkifiedText content={content} style={{ color: '#FFFFFF', fontSize, fontWeight: 'bold', lineHeight: Math.round(fontSize * 1.4), maxWidth }} />;
  }
  return (
    <Host matchContents={{ vertical: true }} pointerEvents="none" style={{ width: maxWidth }}>
      <Text
        color="#FFFFFF"
        modifiers={[blur(7)]}
        style={{ fontSize, fontWeight: 'bold', lineHeight: Math.round(fontSize * 1.4) }}
      >
        {content}
      </Text>
    </Host>
  );
}
