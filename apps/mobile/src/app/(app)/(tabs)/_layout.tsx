import { Tabs } from 'expo-router';

import AnimatedTabBar from '@/components/navigation/animated-tab-bar';
import { TabBarScrollProvider } from '@/components/navigation/tab-bar-scroll';

export default function MainTabsLayout() {
  return (
    <TabBarScrollProvider><Tabs
      tabBar={(props) => <AnimatedTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: true,
      }}
    >
      <Tabs.Screen name="social" options={{ title: 'SOCIAL' }} />
      <Tabs.Screen name="chat" options={{ title: 'CHAT' }} />
      <Tabs.Screen name="contacts" options={{ title: 'FRIENDS' }} />
      <Tabs.Screen name="identity" options={{ title: 'PROFILE' }} />
      <Tabs.Screen name="trading" options={{ href: null }} />
      <Tabs.Screen name="mobile" options={{ title: 'MOBILE' }} />
    </Tabs></TabBarScrollProvider>
  );
}
