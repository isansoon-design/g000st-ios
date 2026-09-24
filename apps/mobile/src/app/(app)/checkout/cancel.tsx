import { Redirect } from 'expo-router';

export default function CheckoutCancelRoute() {
  return <Redirect href="/(app)/(tabs)/mobile?checkout=cancel" />;
}
