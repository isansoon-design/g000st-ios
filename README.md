# g000st - Private Offline Mesh Chat

> **All messages burn. Local only. No logs.**

g000st is a private social chat app designed for true privacy. No servers store your chats. No tracking. Everything burns.

## 🔥 Privacy First

- **ALL Messages Burn** - Every message has a burn timer (5s). After reading, it's gone forever.
- **Local Only** - Messages stay on device. `localStorage` only, no cloud database.
- **No Logs** - We don't log IP, name, email, phone. Nothing.
- **Offline Mesh** - Works via Bluetooth / Multipeer when internet is off (iOS Native Bridge ready).
- **Screenshots Possible** - We warn user, we don't spy.
- **Not an Emergency Service** - This is private chat, not 911.

## 📱 App Store Ready

This build is **Telnyx-free** for TestFlight.

- Removed: `api.telnyx.com` SMS/Call APIs (will be added back after Live release via Twilio/Telnyx)
- Uses: Local mesh + Firebase Messaging (push only)
- No backend collection

### App Privacy Label (for App Store Connect)

- **Data Collected: None**
- **Location:** Used only for NEARBY Mesh discovery, not stored
- **Contacts:** Optional, local only
- **No tracking**

## 🛠 Tech Stack

- Single `index.html` PWA (7700+ lines)
- `Service Worker` - offline ready
- `MeshNative` bridge: `webkit.messageHandlers.meshNative` + Capacitor
- `Blur + Privacy Shield` for sensitive chats
- Manifest: `manifest.webmanifest` + icons 192/512

## 🚀 TestFlight (2 Weeks)

1. Upload `index.html` + `manifest.webmanifest` + icons to `https://g000st.com`
2. Xcode > Settings.swift: `rootUrl = "https://g000st.com/index.html"`
3. Product > Archive > Upload to App Store Connect
4. TestFlight > External Testing > Submit for Beta Review

Valid 90 days, you can stop after 2 weeks.

## 📂 Open Source

This project is open resource.

- `LICENSE: MIT`
- No API keys inside
- All burn logic visible in `index.html`

> We removed Telnyx temporarily to pass Apple review. After Live, we will re-integrate Twilio / Telnyx for private calls.

## ⚖️ Legal

See in-app: Privacy Policy + Terms. Core message:
- Private chat only
- No doxxing / harassment
- Mesh delivery depends on device & permissions
- Not for emergencies

---

Built by g000st team. For the people who care about privacy.
