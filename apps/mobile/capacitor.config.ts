import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'edu.sitcama.mvp',
  appName: 'SIT-CAMA',
  webDir: 'www',
  loggingBehavior: 'none',
  server: { androidScheme: 'https', cleartext: false },
  android: { allowMixedContent: false },
};

export default config;
