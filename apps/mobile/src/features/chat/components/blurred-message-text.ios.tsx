import { Host, Text } from '@expo/ui/swift-ui';
import { LinkifiedText } from "@/components/text/linkified-text";
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
        modifiers={[
          font({ size: fontSize, weight: 'bold' }),
          foregroundStyle('#FFFFFF'),
          lineHeight(Math.round(fontSize * 1.4)),
          multilineTextAlignment('leading'),
          blur(7),
        ]}
      >
        {content}
      </Text>
    </Host>
  );
}
