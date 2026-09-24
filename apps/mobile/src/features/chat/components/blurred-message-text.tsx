import { Text } from 'react-native';

type BlurredMessageTextProps = Readonly<{
  blurred: boolean;
  content: string;
  mine: boolean;
}>;

export function BlurredMessageText({ blurred, content, mine }: BlurredMessageTextProps) {
  return (
    <Text
      accessibilityLabel={blurred ? 'Message hidden by blur' : undefined}
      className={`text-sm font-bold leading-5 ${mine ? 'text-black' : 'text-white'}`}
      style={blurred ? { filter: 'blur(7px)' } : undefined}
    >
      {content}
    </Text>
  );
}
