#!/bin/bash
set -e

echo "========================================="
echo "🏋️ Building Gold Gym Android APK (Release) 🏋️"
echo "========================================="

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_DIR"

# Paths to Android SDK & JDK
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
export PATH="$JAVA_HOME/bin:$PATH"
ANDROID_SDK="$HOME/Library/Android/sdk"
BUILD_TOOLS="$ANDROID_SDK/build-tools/36.0.0"
PLATFORM_JAR="$ANDROID_SDK/platforms/android-36.1/android.jar"

# 1. Clean previous build
rm -rf android/bin android/dex android/compiled_res.zip android/base.apk android/GoldGym-aligned.apk android/debug.keystore
mkdir -p android/bin android/dex

# 2. Compile Android Resources with AAPT2
"$BUILD_TOOLS/aapt2" compile --dir android/src/main/res -o android/compiled_res.zip

# 3. Link Android Resources with AAPT2 (Set minSdkVersion 24, targetSdkVersion 34, version 1)
"$BUILD_TOOLS/aapt2" link -I "$PLATFORM_JAR" \
  android/compiled_res.zip \
  --manifest android/src/main/AndroidManifest.xml \
  --java android/src/main/java \
  --min-sdk-version 24 \
  --target-sdk-version 34 \
  --version-code 1 \
  --version-name "1.0.0" \
  -o android/base.apk

# 4. Compile Java Source Code
"$JAVA_HOME/bin/javac" \
  -cp "$PLATFORM_JAR" \
  -d android/bin \
  android/src/main/java/com/goldgym/portal/*.java

# 5. Convert bytecode to Dalvik Executable (classes.dex) targeting SDK 24+
"$BUILD_TOOLS/d8" \
  --min-api 24 \
  --lib "$PLATFORM_JAR" \
  --output android/dex/ \
  android/bin/com/goldgym/portal/*.class

# 6. Package classes.dex into APK
cd android/dex
zip -j ../base.apk classes.dex
cd "$PROJECT_DIR"

# 7. Optimize APK 4-byte Alignment
"$BUILD_TOOLS/zipalign" -f -p 4 android/base.apk android/GoldGym-aligned.apk

# 8. Generate fresh standard RSA 2048 keystore
"$JAVA_HOME/bin/keytool" -genkey -v \
  -keystore android/debug.keystore \
  -storepass android -alias goldgymkey -keypass android \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -dname "CN=GoldGym,OU=MobileTeam,O=GoldGym,L=Delhi,ST=Delhi,C=IN"

# 9. Sign APK with apksigner (v1, v2, v3 schemes)
"$BUILD_TOOLS/apksigner" sign \
  --ks android/debug.keystore \
  --ks-pass pass:android \
  --key-pass pass:android \
  --v1-signing-enabled true \
  --v2-signing-enabled true \
  --v3-signing-enabled true \
  --out GoldGym.apk \
  android/GoldGym-aligned.apk

# Copy to public folder for direct browser download
cp GoldGym.apk public/GoldGym.apk
cp GoldGym.apk public/IronPulseGym.apk

# 10. Verify APK
echo ""
echo "--- APK Verification ---"
"$BUILD_TOOLS/apksigner" verify --verbose GoldGym.apk
"$BUILD_TOOLS/aapt" dump badging GoldGym.apk | grep -E "package|sdkVersion|targetSdkVersion|application-label"

echo "========================================="
echo "✅ Gold Gym APK Generated & Verified!"
echo "📍 Location: $PROJECT_DIR/GoldGym.apk"
echo "🌐 Web Link: /GoldGym.apk"
echo "========================================="
