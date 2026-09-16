import { Tabs } from 'expo-router';
import type { ColorValue } from 'react-native';

import { TabIcon, type TabIconName } from '@/components/navigation/tab-icon';
import { SafeAreaProvider } from "react-native-safe-area-context";
function renderTabIcon(name: TabIconName) {
  function TabBarIcon({ color }: { color: ColorValue }) {
    return <TabIcon color={color} name={name} />;
  }

  TabBarIcon.displayName = `${name}TabIcon`;
  return TabBarIcon;
}

export default function MainTabsLayout() {
  return (
    <SafeAreaProvider >
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: '#9A9A9A',
          tabBarInactiveTintColor: 'rgba(0,0,0,0.45)',
          tabBarHideOnKeyboard: true,
          tabBarLabelStyle: {
            fontSize: 9,
            fontWeight: '900',
            letterSpacing: 0.35,
            marginTop: 2,
          },
          // tabBarStyle: {
          //   backgroundColor: '#C8C8C8',
          //   borderTopColor: '#BBBBBB',
          //   borderTopWidth: 1,
          //   height: 84,
          //   paddingBottom: 18,
          //   paddingTop: 8,
          // },
        }}
      >
        <Tabs.Screen
          name="chat"
          options={{ title: 'CHAT', tabBarIcon: renderTabIcon('chat') }}
        />
        <Tabs.Screen
          name="contacts"
          options={{ title: 'CONTACTS', tabBarIcon: renderTabIcon('contacts') }}
        />
        <Tabs.Screen
          name="identity"
          options={{ title: 'ID', tabBarIcon: renderTabIcon('identity') }}
        />
        <Tabs.Screen
          name="mobile"
          options={{ title: 'MOBILE', tabBarIcon: renderTabIcon('mobile') }}
        />
      </Tabs>
    </SafeAreaProvider>
  );
}
