// ─────────────────────────────────────────────
//  openworld — central app config
//  All references to the app name come from here.
//  To rename the app, change APP_NAME. That's it.
// ─────────────────────────────────────────────

const APP_NAME = "openworld";

const config = {
  APP_NAME,
  windowTitle: APP_NAME,
  appId: `com.${APP_NAME}.app`,
  logPrefix: `[${APP_NAME}]`,
};

export default config;
export { APP_NAME };
