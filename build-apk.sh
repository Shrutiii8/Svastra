#!/bin/bash
# ==============================================================================
# Svastra — Android APK Local Build Script
# Builds standalone APK and places it into the apk/ folder
# ==============================================================================
set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MOBILE_DIR="$PROJECT_ROOT/mobile"
ANDROID_DIR="$MOBILE_DIR/android"
APK_DEST_DIR="$PROJECT_ROOT/apk"

mkdir -p "$APK_DEST_DIR"

echo "=================================================="
echo "  Svastra Android APK Build"
echo "=================================================="

# 1. Check Java Version
if [ -z "$JAVA_HOME" ]; then
  # Look for JDK 17 or higher in standard Linux paths
  for candidate in /usr/lib/jvm/java-17-openjdk* /usr/lib/jvm/java-21-openjdk* /usr/lib/jvm/default-java; do
    if [ -d "$candidate" ]; then
      export JAVA_HOME="$candidate"
      break
    fi
  done
fi

if [ -n "$JAVA_HOME" ]; then
  export PATH="$JAVA_HOME/bin:$PATH"
  echo "✓ Using JAVA_HOME: $JAVA_HOME"
fi

JAVA_VER=$(java -version 2>&1 | head -n 1)
echo "  Java version: $JAVA_VER"

# 2. Check Android SDK
if [ -z "$ANDROID_HOME" ]; then
  for candidate in "$HOME/Android/Sdk" "$HOME/Android/sdk" "/usr/lib/android-sdk" "/opt/android-sdk"; do
    if [ -d "$candidate" ]; then
      export ANDROID_HOME="$candidate"
      export ANDROID_SDK_ROOT="$candidate"
      break
    fi
  done
fi

if [ -n "$ANDROID_HOME" ]; then
  echo "✓ Using ANDROID_HOME: $ANDROID_HOME"
else
  echo ""
  echo "⚠️  ANDROID_HOME not found in standard paths."
  echo "   If you don't have Android SDK installed locally, build via EAS Cloud Build:"
  echo "   $ cd mobile && npx eas-cli build -p android --profile preview"
  echo ""
fi

# 3. Ensure native android directory exists
if [ ! -d "$ANDROID_DIR" ]; then
  echo "Generating Android native project via expo prebuild..."
  cd "$MOBILE_DIR"
  HOME=/tmp npx expo prebuild --platform android --no-install
fi

# 4. Run Gradle Build
echo "Building APK via Gradle..."
cd "$ANDROID_DIR"

# Try assembleRelease first, fallback to assembleDebug
if ./gradlew assembleRelease; then
  BUILT_APK=$(find "$ANDROID_DIR/app/build/outputs/apk/release" -name "*.apk" | head -n 1)
else
  echo "Release build failed, falling back to assembleDebug..."
  ./gradlew assembleDebug
  BUILT_APK=$(find "$ANDROID_DIR/app/build/outputs/apk/debug" -name "*.apk" | head -n 1)
fi

# 5. Copy APK to apk/ folder
if [ -n "$BUILT_APK" ] && [ -f "$BUILT_APK" ]; then
  cp "$BUILT_APK" "$APK_DEST_DIR/Svastra.apk"
  echo ""
  echo "=================================================="
  echo "✓ APK Build Successful!"
  echo "  Location: $APK_DEST_DIR/Svastra.apk"
  echo "  Size: $(du -h "$APK_DEST_DIR/Svastra.apk" | cut -f1)"
  echo "=================================================="
else
  echo "❌ Built APK file not found."
  exit 1
fi
