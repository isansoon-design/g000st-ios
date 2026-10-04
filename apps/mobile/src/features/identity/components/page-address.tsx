import { Text, View } from "react-native";

export type PageAddressFields = Readonly<{
  city?: string;
  postCode?: string;
  street1?: string;
  street2?: string;
}>;

export function PageAddress({ profile }: { profile: PageAddressFields }) {
  const lines = [profile.city, profile.postCode, profile.street1, profile.street2]
    .map((value) => value?.trim())
    .filter(Boolean);
  if (!lines.length) return null;

  return (
    <View accessibilityLabel="Page address" className="mt-4 gap-1">
      {lines.map((line, index) => (
        <Text key={index} className="text-sm text-black/60 dark:text-night-muted">{line}</Text>
      ))}
    </View>
  );
}
