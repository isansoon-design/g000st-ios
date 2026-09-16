# 📱 تقرير الحالة الحالية - بناء التطبيقات المحمول

## ✅ ما تم إنجازه

### 1. إعداد Capacitor
- ✅ تثبيت Capacitor CLI v8.5.2
- ✅ تثبيت Core packages (@capacitor/core, @capacitor/ios, @capacitor/android)
- ✅ إنشاء `capacitor.config.ts` مع الإعدادات الأساسية
- ✅ إضافة TypeScript support

### 2. إنشاء Native Projects
- ✅ **iOS**: تم إنشاء Xcode project في `ios/App/App.xcodeproj`
- ✅ **Android**: تم إنشاء Android Studio project في `android/`

### 3. نسخ Web Assets
- ✅ إنشاء مجلد `web/` مركزي
- ✅ نسخ `appfg000st.html` → `web/index.html`
- ✅ نسخ `wweindex.html` → `web/admin.html`
- ✅ تشغيل `npx cap sync` لنسخ الملفات إلى platforms

### 4. التوثيق والأدوات
- ✅ إنشاء `MOBILE_BUILD_GUIDE.md` (شرح مفصّل)
- ✅ إنشاء `BUILD_COMMANDS.sh` (أوامر سريعة)
- ✅ إنشاء `web/app-config.js` (إعدادات API و features)

---

## 🚀 الخطوات التالية الفورية

### أ) فتح IDEs (يجب أن تكون مفتوحة الآن)
```bash
# iOS - Xcode
open ./ios/App/App.xcodeproj

# Android - Android Studio
open -a "Android Studio" ./android
```

### ب) اختبار سريع على Simulator

#### iOS Simulator
```bash
# في Xcode:
# 1. Product → Scheme → App
# 2. Product → Destination → iPhone 15 (أو simulator آخر)
# 3. Product → Run (⌘R)

# أو من terminal:
xcodebuild -project ./ios/App/App.xcodeproj \
  -scheme App \
  -configuration Debug \
  -destination 'platform=iOS Simulator,name=iPhone 15'
```

#### Android Emulator
```bash
cd ./android

# 1. شغّل emulator أولاً من Android Studio أو:
/Applications/Android\ Studio.app/Contents/bin/emulator -avd Pixel_5 &

# 2. ثم build + install:
./gradlew installDebug

# 3. بدّل التطبيق من launcher
```

### ج) التحقق من الاتصال بالـ Backend (اختياري)

إذا أردت اختبار مع backend محلي:

```bash
# Terminal منفصل - شغّل backend services:
cd /Users/moudy/Desktop/g000st
pkill -f "node.*server.js\|node.*unified.js" || true

PORT=3001 node backend/g000st-web/server.js &
PORT=3002 node backend/g000st-app/unified.js &
PORT=3003 node backend/g000st-app/server.js &

# ثم في Capacitor app development mode:
export CAP_SERVER_URL=http://127.0.0.1:3001
npx cap run ios
# أو
npx cap run android
```

---

## 📋 قائمة التحقق قبل الإطلاق

### تطوير (Development)
- [ ] اختبار على iOS Simulator ✓
- [ ] اختبار على Android Emulator ✓
- [ ] تحميل البيانات من backend ✓
- [ ] اختبار Chat و Social modules ✓
- [ ] اختبار Mobile UI responsiveness ✓
- [ ] اختبار Profile و SOS ✓

### الإطلاق على الأجهزة الفعلية
- [ ] اختبار على iPhone حقيقي (iOS)
- [ ] اختبار على Android device حقيقي
- [ ] قراءة logs من both platforms
- [ ] اختبار offline mode
- [ ] اختبار slow network

### التوقيع (Signing)

#### iOS
- [ ] تسجيل في Apple Developer account
- [ ] إنشاء Certificate (Development + Distribution)
- [ ] إنشاء Provisioning Profiles
- [ ] إضافة devices
- [ ] تعيين Certificate في Xcode

#### Android
- [ ] إنشاء signing keystore:
  ```bash
  keytool -genkey -v -keystore g000st.keystore \
    -keyalg RSA -keysize 2048 \
    -validity 10000 -alias g000st
  ```
- [ ] حفظ password في مكان آمن
- [ ] تعيين keystore في `android/local.properties`

### الإطلاق على المتاجر

#### App Store
- [ ] إنشاء App ID في Apple Developer
- [ ] إنشاء App Store Connect entry
- [ ] تحضير screenshots (5.5" و 6.5")
- [ ] كتابة app description و keywords
- [ ] اختيار rating
- [ ] بناء Archive (`Product → Archive`)
- [ ] رفع عبر Xcode Organizer

#### Google Play
- [ ] إنشاء Google Play Developer account ($25)
- [ ] إنشاء app entry
- [ ] تحضير screenshots (5.5" و 6.5")
- [ ] تحضير PlayStore listing
- [ ] بناء Release AAB: `./gradlew bundleRelease`
- [ ] رفع AAB عبر Google Play Console

---

## 🔧 أوامر مفيدة

```bash
# Sync web assets بعد تعديل الملفات
npx cap sync

# بناء + تشغيل على Simulator/Emulator
npx cap run ios
npx cap run android

# فتح IDEs
npx cap open ios
npx cap open android

# إعادة تنظيف و بناء
cd ios/App && xcodebuild clean -project App.xcodeproj
cd android && ./gradlew clean

# عرض logs
npx cap run ios --verbose
./gradlew logcat  # Android
```

---

## 📞 ملاحظات تقنية

### البيئات (Environments)
- **Development**: `localhost:3001/3002/3003`
- **Staging**: `api-staging.g000st.com` (إذا توفر)
- **Production**: `api.g000st.com`

### إعدادات App Store & Google Play
- **Bundle ID (iOS)**: `com.g000st.app`
- **Package Name (Android)**: `com.g000st.app`
- **App Version**: `1.0.0`
- **Minimum iOS**: 14.0+
- **Minimum Android**: API 24 (Android 7.0)+

### Firebase
- تأكد من تحديث Firebase config في `web/index.html` و `web/admin.html`
- تفعيل Authentication و Firestore في Firebase Console
- إضافة authorized domains (localhost, g000st.com, etc)

---

## ⚠️ Known Issues & Solutions

| المشكلة | الحل |
|--------|------|
| `xcworkspace not found` | استخدم `.xcodeproj` بدلاً منه |
| `Gradle sync failed` | شغّل `./gradlew clean && ./gradlew build` |
| Web assets لم تُنسخ | استخدم `npx cap sync` |
| Backend not reachable | تأكد من أن services تعمل على ports 3001/3002/3003 |
| iOS build fails | تأكد من signing certificates صحيحة |
| Android build 64-bit warning | احدّث Gradle و NDK |

---

## 📊 ملخص البنية

```
g000st/
├── web/                        # ✅ Web assets (synced to platforms)
│   ├── index.html             # Main app
│   ├── admin.html             # Admin gate
│   └── app-config.js          # Configuration
│
├── ios/App/App.xcodeproj       # ✅ Xcode project (ready to open)
│   ├── App/
│   │   ├── public/            # Web assets (synced)
│   │   └── ...
│
├── android/                     # ✅ Android project (ready to open)
│   ├── app/
│   │   ├── src/
│   │   │   └── main/
│   │   │       ├── assets/
│   │   │       │   └── public/ # Web assets (synced)
│   │   │       └── ...
│   │   └── build.gradle
│   └── ...
│
├── backend/                     # 3 Node.js services (ports 3001/3002/3003)
├── capacitor.config.ts          # Capacitor config
├── MOBILE_BUILD_GUIDE.md        # Detailed guide (بالعربي)
└── BUILD_COMMANDS.sh            # Quick commands
```

---

## ✨ الخطوة الحالية

**الآن:** IDEs مفتوح (Xcode و Android Studio)

**التالي:** اختيار أي platform لبدء الاختبار و البناء الأول.

---

تاريخ الإنشاء: 2024
Version: 1.0.0 RC1
