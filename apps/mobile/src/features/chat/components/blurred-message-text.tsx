import { Text } from 'react-native';

type BlurredMessageTextProps = Readonly<{
  blurred: boolean;
  content: string;
  fontSize?: number;
  maxWidth: number;
}>;

export function BlurredMessageText({ blurred, content, fontSize = 14, maxWidth }: BlurredMessageTextProps) {
  const style = { fontSize, lineHeight: Math.round(fontSize * 1.4), maxWidth };
  return (
    <Text
      accessibilityLabel={blurred ? 'Message hidden by blur' : undefined}
      className="shrink font-bold text-white"
      style={blurred ? { filter: 'blur(7px)', ...style } : style}
    >
      {content}
    </Text>
  );
}
