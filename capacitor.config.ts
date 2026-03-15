import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "il.co.ftable.explainit",
  appName: "ExplainIt",
  webDir: "out",
  backgroundColor: "#0a0a0f",
  server: {
    url: "https://explainit-one.vercel.app",
    cleartext: false,
  },
  ios: {
    scheme: "ExplainIt",
    contentInset: "automatic",
    backgroundColor: "#0a0a0f",
    allowsLinkPreview: false,
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      backgroundColor: "#0a0a0f",
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
  },
};

export default config;
