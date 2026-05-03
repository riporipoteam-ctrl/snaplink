import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.snaplink.network',
  appName: 'SnapLink',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 900,
      backgroundColor: '#020617',
      showSpinner: false,
    },
  },
};

export default config;
