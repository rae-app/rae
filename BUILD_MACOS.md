# Building Rae for macOS

## Quick Build (Recommended)

Run the automated build and sign script:

```bash
./build-and-sign.sh
```

This will:
1. Build the production app
2. Sign it with proper entitlements for screen recording
3. Create both `.app` and `.dmg` bundles

## Manual Build

If you want to build manually:

```bash
# Build the app
npm run tauri build

# Sign with entitlements
./sign-app.sh
```

## Output Location

After building, you'll find:
- **App Bundle**: `src-tauri/target/release/bundle/macos/rae.app`
- **DMG Installer**: `src-tauri/target/release/bundle/dmg/rae_0.1.0_aarch64.dmg`

## macOS Permissions

The app requires the following macOS permissions:

### Screen Recording Permission
- **Why**: To capture window screenshots for AI-powered assistance
- **Location**: System Settings > Privacy & Security > Screen Recording

### Accessibility Permission
- **Why**: To monitor active windows and provide context-aware assistance
- **Location**: System Settings > Privacy & Security > Accessibility

### Apple Events Permission
- **Why**: To control other applications for text injection
- **Location**: Automatically granted when needed

## First Run

1. **Open the app** from `src-tauri/target/release/bundle/macos/rae.app`
2. **Grant permissions** when macOS prompts you
3. If screen capture doesn't work:
   - Go to **System Settings > Privacy & Security > Screen Recording**
   - Remove any old "rae" entries
   - Open the app again and grant permission

## Troubleshooting

### "App is damaged and can't be opened"

This happens if the app loses its signature. Re-run the sign script:

```bash
./sign-app.sh
```

### Screen capture not working

1. Check permissions in System Settings > Privacy & Security > Screen Recording
2. Remove old entries for "rae"
3. Open the app again and allow permission
4. Restart the app

### Permission dialog doesn't appear

Run this command to reset permissions and try again:

```bash
tccutil reset ScreenCapture com.rae.app
```

Then restart the app.

## Development Mode

In development mode, permissions work automatically because the app runs with your terminal's permissions:

```bash
npm run tauri dev
```

## Files Involved

- **`src-tauri/entitlements.plist`**: App entitlements for macOS capabilities
- **`src-tauri/Info.plist`**: Permission usage descriptions
- **`src-tauri/tauri.conf.json`**: App configuration
- **`build-and-sign.sh`**: Automated build and sign script
- **`sign-app.sh`**: Signing script for pre-built apps

## Notes

- The app is **ad-hoc signed** (using `-` as identity) which is fine for local testing
- For distribution, you'll need a proper Apple Developer certificate
- The bundle identifier is `com.rae.app` (consider changing to not end with `.app`)

