# دليل بناء تطبيقات iOS و Android

## المتطلبات
- macOS مع Xcode مثبت
- Android Studio مثبت
- Node.js مثبت (npm)
- Capacitor CLI (مثبت بالفعل: `npx cap`)

## الحالة الحالية

✅ تم إنشاء مجلدات native:
- `ios/` → Xcode project جاهز
- `android/` → Android Studio project جاهز
- `web/` → Web assets synchronized

✅ تم نسخ ملفات الويب:
- `web/index.html` (appfg000st.html)
- `web/admin.html` (wweindex.html)
- Capacitor config files في كل platform

---

## خطوات البناء لـ iOS

### 1. فتح project في Xcode
```bash
cd /Users/moudy/Desktop/g000st/ios
open App.xcworkspace
```

### 2. إعدادات التوقيع (Signing)
1. اختر **App** في المشروع
2. اذهب إلى **Signing & Capabilities**
3. حدد **Team** (حسابك Apple)
4. تأكد من Bundle ID: `com.g000st.app`
5. أكمل أي requirements Xcode

### 3. بناء والاختبار
```bash
# Build للـ simulator
xcodebuild -workspace ios/App/App.xcworkspace -scheme App -configuration Debug -destination 'platform=iOS Simulator,name=iPhone 15'

# أو استخدم Xcode UI:
# Product → Build For → Running
```

### 4. تشغيل على Simulator
```bash
# في Xcode:
# Product → Scheme → App
# Product → Destination → Simulator
# Product → Run (⌧ + R)
```

### 5. الإطلاق على App Store
```bash
# بناء للـ archive
xcodebuild -workspace ios/App/App.xcworkspace -scheme App -configuration Release archive

# ثم استخدم Xcode Organizer:
# Window → Organizer → Archives
# اختر latest archive → Distribute App
```

---

## خطوات البناء لـ Android

### 1. فتح project في Android Studio
```bash
open -a "Android Studio" /Users/moudy/Desktop/g000st/android
```

### 2. إعدادات التوقيع (Signing)
1. **File → Project Structure → Modules → app**
2. اذهب إلى **Signing** tab
3. أنشئ key store (أو استخدم موجود):
   ```bash
   keytool -genkey -v -keystore g000st.keystore -keyalg RSA -keysize 2048 -validity 10000 -alias g000st
   ```
4. حدد المسار والـ password في Android Studio signing config

### 3. بناء APK/AAB
```bash
cd /Users/moudy/Desktop/g000st/android

# بناء APK (للـ testing)
./gradlew assembleDebug

# بناء AAB (للـ Google Play)
./gradlew bundleRelease
```

### 4. تشغيل على Emulator/Device
```bash
# تشغيل emulator أولاً:
/Applications/Android\ Studio.app/Contents/bin/emulator -avd <avd_name> &

# ثم:
cd /Users/moudy/Desktop/g000st/android
./gradlew installDebug
```

### 5. الإطلاق على Google Play
```bash
# Upload AAB من Android Studio:
# Build → Generate Signed Bundle/APK
# اختر AAB
# اختر release signing key
# ثم رفع عبر Google Play Console
```

---

## اختبار التطبيق محليًا

### تشغيل backend محليًا (اختياري)
```bash
# من terminal منفصل:
cd /Users/moudy/Desktop/g000st
pkill -f "node.*server.js\|node.*unified.js" || true

# شغّل الخدمات الثلاث:
PORT=3001 node backend/g000st-web/server.js &
PORT=3002 node backend/g000st-app/unified.js &
PORT=3003 node backend/g000st-app/server.js &
```

### اختبار على الهاتف الفعلي
1. **iOS**: متى شغّل على device جديد، ثق في developer certificate
2. **Android**: فعّل USB Debugging من Developer Options

---

## ملاحظات مهمة

1. **Web Assets**: يتم نسخ تلقائياً من `web/` عند تشغيل `npx cap sync`
2. **Backend URL**: إذا غيرت backend URL (مثل server بدل localhost)، عدّل capacitor.config.ts:
   ```typescript
   server: {
     url: 'https://your-backend.com',
     cleartext: false,
   }
   ```
3. **Permissions**: إضافة permissions (camera, microphone, etc) في:
   - iOS: `Info.plist` في Xcode
   - Android: `AndroidManifest.xml`
4. **Firebase**: تأكد من تحديث Firebase config إذا لزم الحال في web app

---

## troubleshooting

### خطأ "Could not find App.xcworkspace"
```bash
cd ios/App
xcode-select --install
```

### خطأ Gradle في Android
```bash
cd android
./gradlew clean
./gradlew build
```

### web assets لم تُنسخ
```bash
npx cap sync
```

---

**آخر تحديث**: Capacitor 8.5.2
**App ID**: com.g000st.app
**Version**: 1.0.0
