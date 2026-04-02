# Google Maps API Key Setup in Expo

This document explains how Google Maps API key restrictions work with Expo and EAS Build, and answers the crucial question: **Do I need to update my API key restrictions every time I build or prebuild?**

## The Short Answer
**No.** You do not need to update your API key restrictions every time you run `npx expo prebuild` or `eas build`, **as long as you use persistent credentials.**

API key restrictions in Google Cloud Console rely on **two things**:
1. Your App's Package Name (e.g., `com.aushadx.mobileclient`)
2. The **SHA-1 Fingerprint** of the Keystore used to sign the `.apk` or `.aab`.

The SHA-1 fingerprint changes *only if the Keystore changes*. 

---

## Environment 1: Local Development (Emulators & USB Debugging)

When you run `npx expo run:android` locally, Expo automatically generates a **Debug Keystore** (`debug.keystore`) on your machine inside `android/app/`. 

- **Does the Debug Keystore change on prebuild?** 
  No. Expo's default behavior is to reuse the local `debug.keystore` even if you delete the `android` folder and run `npx expo prebuild` again. 
- **When WILL it change?** 
  If you format your computer, clone the repo to a completely new laptop, or manually delete your `~/.android/debug.keystore`, a new one will be generated with a new SHA-1 fingerprint.

### How to get your Local Debug SHA-1:
Run this in your terminal (Windows):
```powershell
keytool -list -v -keystore "%USERPROFILE%\.android\debug.keystore" -alias androiddebugkey -storepass android -keypass android
```
**(Mac/Linux)**
```bash
keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android
```
Copy the `SHA1` value and add it to Google Cloud Console.

---

## Environment 2: Production Builds (EAS Build)

When you build your app for the Play Store using Expo Application Services (`eas build --platform android`), EAS generates a **Production Keystore** and securely stores it in the cloud.

- **Does the EAS Production Keystore change on every build?**
  **No.** EAS creates the keystore *once* per app and securely stores it on Expo's servers. Every future `eas build` for that specific project will use the exact same keystore, meaning the SHA-1 fingerprint is permanent.

### How to get your EAS Production SHA-1:
1. Run `eas credentials` in your terminal.
2. Select `Android`.
3. Select the build profile you want to inspect (usually `production`).
4. Select `Fetch credentials from EAS`.
5. The CLI will print out your Keystore details, including the **SHA-1 Fingerprint**.

Copy this `SHA1` value and add it to Google Cloud Console **alongside** your debug SHA-1.

---

## Proper Setup Workflow (Do this ONCE)

To ensure your Google Maps API key always works locally and in production without ever touching it again:

1. **Get Local SHA-1:** Run the `keytool` command shown above on your computer.
2. **Get EAS SHA-1:** Run `eas credentials` to get your production cloud fingerprint.
3. **Go to Google Cloud Console:** Navigate to APIs & Services > Credentials.
4. **Edit your Maps API Key:** Under "Application restrictions", choose Android apps.
5. **Add Local Fingerprint:** Add an item with Package Name `com.aushadx.mobileclient` and your Local Debug SHA-1.
6. **Add Production Fingerprint:** Add a *second* item with Package Name `com.aushadx.mobileclient` and your EAS Production SHA-1.
7. **Save.**

From here on out, whether you `npx expo prebuild` 100 times, or run `eas build` 100 times, your Google maps will permanently work and remain securely restricted to your app!
