import { Text } from 'react-native';

type BlurredMessageTextProps = Readonly<{
  blurred: boolean;
  content: string;
  mine: boolean;
  fontSize?: number;
}>;

export function BlurredMessageText({ blurred, content, mine, fontSize = 14 }: BlurredMessageTextProps) {
  const style = { fontSize, lineHeight: Math.round(fontSize * 1.4) };
  return (
    <Text
      accessibilityLabel={blurred ? 'Message hidden by blur' : undefined}
      className={`font-bold ${mine ? 'text-black' : 'text-white'}`}
      style={blurred ? { filter: 'blur(7px)', ...style } : style}
    >
      {content}
    </Text>
  );
}
