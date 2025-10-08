#!/bin/bash

# Complete build and sign script for macOS

echo "🚀 Building Rae for macOS..."
echo ""

# Build the app
npm run tauri build

if [ $? -ne 0 ]; then
    echo "❌ Build failed"
    exit 1
fi

echo ""
echo "✅ Build completed!"
echo ""

# Sign the app
./sign-app.sh

echo ""
echo "🎉 All done! Your app is ready at:"
echo "   📦 src-tauri/target/release/bundle/macos/rae.app"
echo "   💿 src-tauri/target/release/bundle/dmg/rae_0.1.0_aarch64.dmg"
echo ""
echo "⚠️  IMPORTANT: Before running, go to:"
echo "   System Settings > Privacy & Security > Screen Recording"
echo "   Remove any old 'rae' entries, then run the new app and grant permission."

