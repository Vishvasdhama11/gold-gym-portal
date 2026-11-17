#!/bin/bash
set -e

echo "========================================="
echo "🏋️ Building IronPulse Gym Android APK 🏋️"
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
rm -rf android/bin android/dex android/compiled_res.zip android/base.apk android/IronPulseGym-aligned.apk
mkdir -p android/bin android/dex

# 2. Compile and Link Android Resources with AAPT2
"$BUILD_TOOLS/aapt2" compile --dir android/src/main/res -o android/compiled_res.zip
"$BUILD_TOOLS/aapt2" link -I "$PLATFORM_JAR" \
  android/compiled_res.zip \
  --manifest android/src/main/AndroidManifest.xml \
  --java android/src/main/java \
  -o android/base.apk

# 3. Compile Java Source Code
"$JAVA_HOME/bin/javac" \
  -cp "$PLATFORM_JAR" \
  -d android/bin \
  android/src/main/java/com/ironpulse/gym/*.java

# 4. Convert bytecode to Dalvik Executable (classes.dex)
"$BUILD_TOOLS/d8" \
  --lib "$PLATFORM_JAR" \
  --output android/dex/ \
  android/bin/com/ironpulse/gym/*.class

# 5. Package classes.dex into APK
cd android/dex
zip -j ../base.apk classes.dex
cd "$PROJECT_DIR"

# 6. Optimize APK Alignment
"$BUILD_TOOLS/zipalign" -f -p 4 android/base.apk android/IronPulseGym-aligned.apk

# 7. Sign APK with apksigner
if [ ! -f "android/debug.keystore" ]; then
  "$JAVA_HOME/bin/keytool" -genkey -v \
    -keystore android/debug.keystore \
    -storepass android -alias androiddebugkey -keypass android \
    -keyalg RSA -keysize 2048 -validity 10000 \
    -dname "CN=IronPulseGym,OU=GymManagement,O=IronPulse,C=IN"
fi

"$BUILD_TOOLS/apksigner" sign \
  --ks android/debug.keystore \
  --ks-pass pass:android \
  --key-pass pass:android \
  --out IronPulseGym.apk \
  android/IronPulseGym-aligned.apk

# 8. Verify APK
"$BUILD_TOOLS/apksigner" verify --verbose IronPulseGym.apk

echo "========================================="
echo "✅ APK Generated Successfully!"
echo "📍 Location: $PROJECT_DIR/IronPulseGym.apk"
echo "========================================="
