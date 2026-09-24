import { Redirect } from 'expo-router';

export default function CheckoutSuccessRoute() {
  return <Redirect href="/(app)/(tabs)/mobile?checkout=success" />;
}
