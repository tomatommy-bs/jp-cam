import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  // TODO: 仮の ID。ストア公開前に確定させる (公開後は変更不可)。
  appId: 'com.tomatommy.jpcam',
  appName: 'JP-CAM',
  webDir: 'out',
  backgroundColor: '#000000',
  ios: {
    contentInset: 'never',
  },
};

export default config;
