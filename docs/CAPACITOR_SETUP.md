# YARDEES iOS App — Capacitor Setup Guide

This is a step-by-step checklist to take YARDEES from web app → published on the Apple App Store.
Most of this you'll do on your **Mac** (Capacitor's iOS tooling only runs on macOS).

---

## ✅ What's already done in this codebase

- `@capacitor/core`, `@capacitor/ios`, `@capacitor/cli`, `@capacitor/splash-screen`, `@capacitor/status-bar`, `@capacitor/app`, `@capacitor/haptics` installed
- `capacitor.config.ts` configured (app ID `com.yardees.app`, brand green splash, points to `https://www.yardees.net`)
- App icons generated in `client/public/`:
  - `appstore-icon-1024.jpg` — upload this to App Store Connect
  - `icon-1024.png` / `180.png` / `167.png` / `152.png` / `120.png` — for the Xcode project
- **Delete Account** feature in Dashboard (Apple required this — Guideline 5.1.1(v))

---

## 🛠️ One-time Mac setup

1. **Install Xcode** from the Mac App Store (free, ~10 GB, slow first download)
2. **Install Xcode Command Line Tools**: `xcode-select --install` in Terminal
3. **Install CocoaPods**: `sudo gem install cocoapods` (Capacitor uses it for iOS)
4. **Install Node.js 20+** if you don't have it: [nodejs.org](https://nodejs.org)

---

## 📱 Adding the iOS project (do this once on your Mac)

```bash
# 1. Open your local YARDEES folder in Terminal
cd path/to/yardees

# 2. Install dependencies (only needed first time after pulling)
npm install

# 3. Add the iOS native project — creates an `ios/` folder
npx cap add ios

# 4. Sync web assets + plugin config into the iOS project
npx cap sync ios

# 5. Open the iOS project in Xcode
npx cap open ios
```

Xcode will now open with the YARDEES iOS workspace. You're ready to configure signing.

---

## 🔑 Xcode signing setup

1. In Xcode, click the **App** target (top of left sidebar)
2. Go to **Signing & Capabilities** tab
3. Check **"Automatically manage signing"**
4. **Team** dropdown → select your Apple Developer Team
5. **Bundle Identifier** → confirm it reads `com.yardees.app` (or change to whatever you registered)
6. Xcode will auto-generate provisioning profiles

---

## 🎨 Setting the app icon in Xcode

1. In Xcode, expand **App** → **App** → **Assets.xcassets** → **AppIcon**
2. Drag `client/public/icon-1024.png` (the one with cream background) into the **App Store** slot (1024×1024)
3. iOS will derive the other sizes automatically (or you can drag the smaller ones into matching slots)

---

## ▶️ Test on your iPhone

1. Plug your iPhone into your Mac with a USB-C / Lightning cable
2. In Xcode, select your iPhone in the device dropdown (top bar, next to the play button)
3. Click the **▶ Play** button
4. **On your iPhone first time:** Settings → General → VPN & Device Management → trust your developer certificate
5. The YARDEES app should launch on your phone, showing the splash screen → then your live website

---

## 📤 Submitting to the App Store

### Step 1: Archive the app
1. In Xcode, top menu: **Product → Destination → Any iOS Device (arm64)**
2. **Product → Archive** (takes a few minutes)
3. Organizer window opens with your archive

### Step 2: Upload to App Store Connect
1. Click **Distribute App** → **App Store Connect** → **Upload**
2. Use automatic signing, default settings
3. Click **Upload** (takes 5–15 min)

### Step 3: Configure listing in App Store Connect
Go to [appstoreconnect.apple.com](https://appstoreconnect.apple.com) → My Apps → YARDEES

Fill out:
- **App Information**
  - Privacy Policy URL: `https://www.yardees.net/privacy`
  - Support URL: `https://www.yardees.net/contact`
  - Marketing URL: `https://www.yardees.net`
  - Category: **Shopping**
- **Pricing and Availability**: Free, all countries
- **App Privacy**: fill out data collection (email, name, location for nearby listings, photos for listings)
- **Version Info**
  - **Description** (write this — see template below)
  - **Keywords**: `yard sale,thrift,marketplace,secondhand,garage sale,vintage,resell,buy,sell,local`
  - **Screenshots**: at least 3 for 6.7" iPhone (1290×2796). Take these from your iPhone after running the app.
  - **App Icon**: upload `appstore-icon-1024.jpg`
  - **Support contact**: your email
- **Build**: select the build you just uploaded
- **Age Rating**: fill questionnaire (likely 12+ for user-generated content)

### Step 4: Submit for review
Click **Submit for Review**. Apple typically reviews in **1–3 days**.

---

## 📝 Description template (copy into App Store Connect)

> **YARDEES — Second hand never looked this good**
>
> Discover yard sales, thrift shops, and pre-loved treasures near you. YARDEES is the local marketplace for sellers and buyers of second-hand goods.
>
> • Browse listings filtered by category, distance, and price
> • Find local yard sales, garage sales, and estate sales on the map
> • Discover nearby thrift shops and vintage stores
> • Sell your items in minutes with photos and pricing tools
> • Real-time messaging with buyers and sellers
> • Make and receive offers with secure escrow payments
> • Save searches and get notified when new matches appear
> • Earn rewards points for activity
>
> Join thousands of buyers and sellers turning second hand into something special.

---

## 🔁 Updating the app after publishing

Because the iOS app loads `https://www.yardees.net`, **most updates need NO new submission**. Just push to Railway and the app reflects changes instantly.

You only need to resubmit when:
- Adding new native features (push notifications, in-app purchases)
- Changing the splash screen, icon, or `capacitor.config.ts`
- Apple requires a SDK update (~once a year)

To resubmit:
```bash
npx cap sync ios       # sync any plugin/config changes
npx cap open ios       # open Xcode
# Then: bump version in Xcode → Archive → Upload
```

---

## 🚨 Common rejection reasons (avoid these)

1. **No way to delete account** ✅ already added
2. **Privacy policy missing or broken link** → confirm `/privacy` loads
3. **Crashes on launch** → test on physical device first
4. **App is "just a webview"** → mitigation: native splash screen, status bar styling, haptic feedback, and `App` plugin are all configured. If still rejected, we can switch to bundled (offline-capable) mode.
5. **Login screen with no public content** → ✅ YARDEES shows listings without login

---

## 🆘 Help

If anything in this guide fails, tell me what step + what error and I'll help debug.
