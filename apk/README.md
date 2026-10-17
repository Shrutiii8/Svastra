# Svastra Android APK Installation Guide

This directory holds the standalone Android APK (`Svastra.apk`) for physical device installation.

---

## Option 1: EAS Cloud Build (Fastest — No Android SDK or Java 17 Required)

Expo's cloud builder compiles the standalone installable `.apk` on remote cloud machines:

1. In the `mobile/` directory, run:
   ```bash
   cd mobile
   npx eas-cli build -p android --profile preview
   ```
   *(Or install globally: `npm install -g eas-cli && eas build -p android --profile preview`)*
2. Log in with your Expo account (or create a free one).
3. Once the build completes (~5 minutes), EAS provides a download URL for the `.apk`.
4. Download the file into this folder:
   ```bash
   curl -L -o ../apk/Svastra.apk "<DOWNLOAD_URL>"
   ```

---

## Option 2: Local Build via Gradle

If you have **OpenJDK 17** and **Android SDK (API 34)** installed on your machine:

1. Install prerequisites (if not already installed on Ubuntu/Debian):
   ```bash
   sudo apt update
   sudo apt install -y openjdk-17-jdk
   ```
2. Set your environment variables:
   ```bash
   export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
   export ANDROID_HOME=$HOME/Android/Sdk
   ```
3. Run the automated build script from the project root:
   ```bash
   ./build-apk.sh
   ```
   The script will automatically compile and save the resulting file to `apk/Svastra.apk`.

---

## Installing on Android Device

Once `Svastra.apk` is generated:
- Transfer `Svastra.apk` to your phone via USB cable, Google Drive, WhatsApp, or email.
- Tap the `.apk` file on your phone and select **Install**.
- If prompted, allow **"Install unknown apps"** in Android Settings.
- Open **Svastra** directly on your device.
