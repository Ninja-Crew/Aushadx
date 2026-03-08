const { withProjectBuildGradle } = require('@expo/config-plugins');

/**
 * Expo config plugin to inject the local Notifee maven repository
 * into the Android project-level build.gradle. This is required because
 * @notifee/react-native ships its AAR in the npm package itself and
 * does not publish to any public Maven repository.
 */
const withNotifee = (config) => {
  return withProjectBuildGradle(config, (mod) => {
    const contents = mod.modResults.contents;
    const notiteeMaven = `    maven { url "$rootDir/../node_modules/@notifee/react-native/android/libs" }`;

    // Only inject if not already present
    if (!contents.includes('@notifee/react-native/android/libs')) {
      mod.modResults.contents = contents.replace(
        /allprojects\s*\{\s*\n\s*repositories\s*\{/,
        `allprojects {\n  repositories {`
      ).replace(
        /maven\s*\{\s*url\s*'https:\/\/www\.jitpack\.io'\s*\}/,
        `maven { url 'https://www.jitpack.io' }\n${notiteeMaven}`
      );
    }

    return mod;
  });
};

module.exports = withNotifee;
