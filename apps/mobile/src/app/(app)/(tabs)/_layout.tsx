import { Tabs } from 'expo-router';

import AnimatedTabBar from '@/components/navigation/animated-tab-bar';

export default function MainTabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <AnimatedTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: true,
      }}
    >
      <Tabs.Screen name="social" options={{ title: 'SOCIAL' }} />
      <Tabs.Screen name="chat" options={{ title: 'CHAT' }} />
      <Tabs.Screen name="contacts" options={{ title: 'CONTACTS' }} />
      <Tabs.Screen name="identity" options={{ title: 'ID' }} />
      <Tabs.Screen name="mobile" options={{ title: 'MOBILE' }} />
    </Tabs>
  );
}

