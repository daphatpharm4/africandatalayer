import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.africandatalayer.app',
  appName: 'African Data Layer',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: false,
      backgroundColor: '#0f2b46',
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#0f2b46',
    },
  },
  android: {
    minWebViewVersion: 90,
    allowMixedContent: false,
  },
};

export default config;
