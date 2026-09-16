import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.g000st.app',
  appName: 'g000st',
  webDir: 'web',
  server: {
    androidScheme: 'https',
    url: process.env.CAP_SERVER_URL,
    cleartext: process.env.CAP_SERVER_URL ? true : false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 0,
    },
  },
};

export default config;
