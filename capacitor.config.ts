import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.6e6bc54db3fa4727976665eb6e2cf3da',
  appName: 'MUCO-AMPLITUDE',
  webDir: 'dist',
  // Mode production / Air-Gap : pas de serveur distant (utilise dist/ embarqué)
  // Pour le hot-reload en dev, décommenter le bloc 'server' ci-dessous :
  // server: {
  //   url: 'https://6e6bc54d-b3fa-4727-9766-65eb6e2cf3da.lovableproject.com?forceHideBadge=true',
  //   cleartext: true,
  // },
  android: {
    backgroundColor: '#0f1b3d',
  },
  ios: {
    backgroundColor: '#0f1b3d',
  },
};

export default config;