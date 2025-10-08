#!/bin/bash

# Script to sign the macOS app with proper entitlements after building

APP_PATH="src-tauri/target/release/bundle/macos/rae.app"
ENTITLEMENTS="src-tauri/entitlements.plist"

echo "🔐 Signing app with entitlements..."

# Clean extended attributes
xattr -cr "$APP_PATH"

# Sign with entitlements
codesign --force --deep --sign - --entitlements "$ENTITLEMENTS" "$APP_PATH"

if [ $? -eq 0 ]; then
    echo "✅ App signed successfully!"
    echo ""
    echo "📋 Entitlements applied:"
    codesign -d --entitlements - "$APP_PATH/Contents/MacOS/rae" 2>&1 | grep -A 1 "Key"
    echo ""
    echo "📦 App location: $APP_PATH"
    echo ""
    echo "⚠️  Important: If you've run this app before, you need to:"
    echo "   1. Go to System Settings > Privacy & Security > Screen Recording"
    echo "   2. Remove the old 'rae' entry"
    echo "   3. Run the app again and grant permission"
else
    echo "❌ Failed to sign app"
    exit 1
fi

