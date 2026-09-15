# خطة تحويل تطبيق g000st للهاتف إلى Expo SDK 56

آخر تحديث: 15 سبتمبر 2026

حالة الوثيقة: تحليل وخطة تنفيذ؛ لم يبدأ تحويل التطبيق بعد.

## 1. الهدف

إعادة بناء تطبيق الهاتف الموجود في `appfg000st.html` كتطبيق React Native حقيقي باستخدام Expo SDK 56، مع:

- مطابقة التصميم والانتقالات والحالات المرئية.
- الحفاظ على تجربة الـID من 50 حرفًا، مع فصل `Public ID` القابل للمشاركة عن `Recovery ID` السري المستخدم لاستعادة/إثبات ملكية الحساب.
- محادثات فردية خاصة فقط، بلا غرف عامة أو مجموعات.
- SMS ومكالمات وأرقام هاتف ودفع كخدمات حقيقية.
- إبقاء حذف Burn محليًا على الجهاز في الإصدار الأول، إلى أن تُحسم سياسة الحذف النهائية.
- عدم نقل لوحة الإدارة أو Trading أو Network/Whisper الخاصة بالويب إلى تطبيق الهاتف.

## 2. القرارات المؤكدة

1. مصدر تطبيق الهاتف الوحيد هو `appfg000st.html`.
2. لا توجد Group Chats في تطبيق الهاتف الجديد.
3. كل محادثة مرتبطة بمستخدمين اثنين فقط.
4. خدمات Mobile ليست محاكاة في النسخة الجديدة؛ يجب ربطها بمزود حقيقي.
5. واجهة الـ50-character ID ستبقى جزءًا أساسيًا من التسجيل والدخول.
6. تُفصل هوية الحساب إلى `Public ID` للمشاركة والبحث، و`Recovery ID` سري لا يُعرض للآخرين.
7. Burn في المرحلة الأولى يحذف من الجهاز فقط.
8. لا توجد نسخة إنتاجية سابقة تحتاج إلى ترحيل بيانات WebView أو Capacitor.
9. الإصدار المستهدف هو Expo SDK 56.
10. مشروع Next.js ولوحة الإدارة خارج نطاق التنفيذ الأول لتطبيق الهاتف، مع اعتماد بنية تسمح بتوحيد تجربة المستخدم لاحقًا بين الويب والهاتف.

## 3. مصادر الحقيقة

ترتيب الاعتماد عند وجود تعارض:

1. السلوك المرئي الفعلي في `appfg000st.html`.
2. قرارات صاحب المشروع المثبتة في هذه الوثيقة.
3. سلوك الباك الحي بعد التحقق منه.
4. ملفات التوثيق السابقة بصفتها مراجع مساعدة فقط.

لا يُعتبر مشروع Next.js الحالي مرجعًا لمنطق الهاتف لأنه يعتمد بدرجة كبيرة على بيانات تجريبية ومسارات API غير متوافقة مع الباك الحي.

## 4. النطاق الوظيفي لتطبيق Expo

### 4.1 الدخول والهوية

- إنشاء ID من 50 حرفًا.
- إدخال ID موجود.
- شاشة الترحيب والموافقة على Privacy وTerms.
- حفظ جلسة الجهاز بأمان.
- نسخ ومشاركة الهوية العامة.
- استعادة الحساب بعد تحديد نموذج الاستعادة الآمن.

### 4.2 Chat الفردي

- محادثة منفصلة لكل جهة اتصال.
- إرسال النصوص واستقبالها لحظيًا.
- Reply وReactions وتعديل وحذف رسائل المستخدم.
- حالات Sent وDelivered وRead حقيقية.
- Burn 5s وحذف السجل المحلي بعد ساعتين حسب المواصفات الحالية.
- Blur/Protect وإخفاء الواجهة في الخلفية.
- رسائل صوتية مع waveform.
- صور وملفات فعلية.
- Offline outbox مع إعادة إرسال موثوقة.
- Wallpaper وحجم النص.
- Block وReport فعليان.

### 4.3 Contacts

- البحث والإضافة بواسطة ID.
- QR محلي وآمن.
- استيراد الاسم/الهاتف من جهات اتصال الجهاز بعد الإذن.
- All وOnline وFavorites.
- فتح المحادثة الفردية والمكالمة.
- لا يوجد إنشاء مجموعات.

### 4.4 Profile

- ID ونسخ ومشاركة.
- الصورة والاسم والجنس والعمر والدولة والهواية والاهتمامات.
- نغمات الاتصال والمعاينة.
- Privacy وTerms.
- Support tickets مع مرفقات.

### 4.5 Social

- Home Feed وMy Page وAlerts.
- نشر نص وصورة.
- Like وComment وShare وEdit وDelete.
- Follow/Camp حسب التسمية النهائية.
- فتح ملف المستخدم ومحادثة Social خاصة.
- لا تُستخدم بيانات تجريبية في النسخة النهائية.

### 4.6 Mobile

- رقم هاتف حقيقي يخصصه المزود.
- Keypad ومكالمات فعلية.
- SMS حقيقي.
- Contacts وFavorites وRecents.
- خطط 5 SMS و10 دقائق و30 دقيقة، بعد تثبيت المنتجات النهائية.
- Apple Pay وGoogle Pay/Stripe من خلال تدفق دفع يتحقق منه السيرفر.
- الرصيد والاستهلاك يحسبان على السيرفر، لا على الجهاز.

### 4.7 الوظائف غير الداخلة في النطاق الأول

- Trading.
- Network وWhisper الخاصة بـ`wweindex.html`.
- Group Chats.
- SOS وMedical وICE ما لم يُطلب إدخالها لاحقًا.
- Admin داخل تطبيق الهاتف.

## 5. ملخص مشاكل التطبيق الأصلي

- Chat الرئيسي يستخدم مخزن رسائل واحدًا وغرفة RTDB واحدة بدل محادثة لكل مستخدمين.
- تغيير Contact يغير اسم العنوان فقط ولا يغير المحادثة.
- Delivered وRead مؤقتات محلية وليست حالات من الطرف الآخر.
- Burn والحذف بعد ساعتين لا يحذفان النسخة البعيدة.
- الصور والملفات لا تصل فعليًا عبر مسار Chat الشبكي.
- Social يحفظ المنشورات والتفاعلات محليًا، ودوال المزامنة ليست مربوطة بالتدفق الفعلي.
- Social Chat يرسل نصًا إلى RTDB، لكن polling لا يبدأ عند فتح الشاشة.
- Block وReport غير مطبقين على الشبكة.
- Mobile يمنح رقمًا ورصيدًا محليًا، ويمكن فتح الخطة دون دفع عند غياب PaymentRequest.
- لا توجد مكالمات أو SMS حقيقية في المسار الأساسي.
- Push Notifications وService Worker غير مكتملين.
- خط Optimistic مشار إليه لكن ملفاته غير موجودة.
- الملف الواحد يحتوي 37 كتلة Script وعشرات التصحيحات والتعريفات المتراكمة؛ لا يجوز نقله سطرًا بسطر.

## 6. نتائج تدقيق الباك الحي

تم التدقيق عبر SSH alias `g000st-web` للقراءة فقط.

### 6.1 الخدمة العاملة

- PM2 يشغّل خدمة باسم `g000st-web`.
- الملف العامل هو `/root/g000st-package/server.js`، وليس `/root/server.js`.
- الملف العامل مختلف عن النسخ المحلية.
- Node.js على السيرفر: 20.20.2.
- Nginx يمرر `/api/` وبقية الموقع إلى Node على المنفذ 3000.

### 6.2 المسارات الموجودة في الخدمة العاملة

- `GET /api/check`
- `GET /check-code`
- `GET /api/check-code`
- `POST /api/claim`
- `GET /api/feed`
- `POST /api/post`
- `GET /api/page/:id`
- `GET /api/stripe/config`
- `GET /stripe-checkout`
- `GET /api/stripe/checkout`
- `POST /api/stripe/create-checkout`
- `POST /stripe/webhook`

### 6.3 ما هو غير موجود في الخدمة العاملة

- Authentication sessions للمستخدمين.
- Private conversations/messages API.
- Media upload.
- Reactions/receipts/block/report.
- Push token registration.
- Support tickets API.
- `POST /api/send-sms`.
- `POST /api/call/init`.
- Telnyx أو مزود مكالمات/SMS آخر.
- Number provisioning.
- Server-side credit ledger.
- Rate limiting وAuthorization.

لم يُعثر على أي تنفيذ سابق لـTelnyx أو لمساري SMS/Calls ضمن ملفات الباك على الخادم.

### 6.4 Firebase

لقطة التدقيق بتاريخ هذه الوثيقة:

- Firestore يحتوي Collections: `codes`, `config`, `listings`, `pages`, `posts`, `users`.
- توجد بيانات حالية يجب عدم حذفها أو تنظيفها دون موافقة منفصلة.
- Firebase Authentication يحتوي حسابين ولا توجد Custom Claims.
- Cloud Functions الفعالة: `generateCode` و`generateCodeHttp`.
- عنوان RTDB الموجود في تطبيق الهاتف يعيد 404 ويحتاج تحديد الـinstance الصحيح أو الاستغناء عنه.

خطر أمني حرج: قواعد Firestore المنشورة حاليًا هي:

```text
match /{document=**} {
  allow read, write: if true;
}
```

هذا يسمح لأي عميل بالقراءة والكتابة والحذف. يجب استبداله بقواعد حقيقية قبل ربط تطبيق Expo، لكن لا تُعدّل القواعد قبل تجهيز Authentication واختبار توافق الويب الحالي.

### 6.5 Stripe

- Stripe مفعّل على الخدمة الحية.
- Checkout وWebhook موجودان.
- الخطط الموجودة على الباك: `sms`, `voice10`, `voice30`.
- أسماء الخطط في تطبيق الهاتف القديم تختلف جزئيًا: `sms5`, `min10`, `min30`.
- لا يوجد endpoint موثوق يجلب الرصيد الحالي أو Ledger للاستهلاك.
- منح الصلاحية يجب أن يتم بعد webhook موثوق فقط.

## 7. القرار المعماري المستهدف

### 7.1 تطبيق الهاتف

- Expo SDK 56 + React Native + TypeScript strict.
- Expo Router للتنقل.
- Development Build وEAS Profiles: development، preview، production.
- Design system داخلي مشتق من التصميم الأصلي.
- SecureStore للجلسات والمفاتيح الصغيرة.
- SQLite للرسائل والحالة المحلية والفهارس وOutbox.
- FileSystem للصوت والصور والملفات.
- Repository interfaces لفصل UI عن Local/Remote data sources.
- API client واحد بعقود typed وأخطاء موحدة.

قدرات Expo المتوقعة:

- Camera/Barcode للـQR.
- Contacts لدفتر الهاتف.
- Image Picker وDocument Picker.
- Audio للتسجيل والتشغيل.
- Notifications.
- Local Authentication.
- Sharing وClipboard وHaptics.
- AppState لحماية شاشة التطبيق في الخلفية.

### 7.2 الباك

لن يُعاد من الصفر. سيتم تطوير الخدمة الحالية وتوحيدها تحت عقد versioned مثل `/api/v1`.

التقسيم المقترح:

- Express API للهوية والجلسات والعمليات الحساسة.
- Firebase Auth/Custom Tokens أو جلسات موقعة لإثبات هوية المستخدم.
- Firestore realtime للمحادثات بعد وضع قواعد صارمة، أو WebSocket إذا أثبت الـspike أنه أنسب.
- Object Storage للمرفقات.
- Stripe للشراء والتحقق من Entitlements.
- Telnyx أو المزود الذي يحدده العميل للأرقام وSMS والمكالمات.
- Webhooks موثقة وموقعة للدفع والاتصالات.
- Admin API بصلاحيات server-side.

### 7.3 نموذج البيانات الأولي

- `users`: الهوية العامة والملف والحالة.
- `devices`: الأجهزة ومفاتيح Push والجلسات.
- `conversations`: محادثة فردية وعضوان فقط.
- `messages`: text/image/file/voice وحالات التسليم والقراءة.
- `local_deletions`: في SQLite للجهاز، بما يتوافق مع قرار Burn المحلي.
- `posts`, `comments`, `reactions`, `follows`.
- `blocks`, `reports`.
- `phone_numbers`, `sms_messages`, `calls`.
- `entitlements`, `credit_ledger`, `payment_events`.
- `support_tickets`, `support_messages`.

## 8. قرار الهوية الأمني المعتمد

النسخة القديمة تستخدم نفس ID في المشاركة مع الأصدقاء وفي تسجيل الدخول. هذا يجعل معرفة الهوية العامة كافية لانتحال الحساب.

القرار المعتمد هو فصل القيمتين:

1. `Public ID`: معرّف من 50 حرفًا قابل للنسخ والمشاركة والبحث وإضافة جهات الاتصال.
2. `Recovery ID`: سر مختلف من 50 حرفًا يُنشأ بأمان ويُستخدم لاستعادة/إثبات ملكية الحساب، ولا يُرسل للأصدقاء ولا يظهر في الملف العام.

يمكن الحفاظ على شكل وتجربة الشاشة الأصلية، لكن القيمة التي يشاركها المستخدم لن تكون كلمة المرور الوحيدة للحساب. تُحفظ جلسة الجهاز في التخزين الآمن، وتُعرض للمستخدم خطوة واضحة لحفظ `Recovery ID` عند إنشاء الحساب.

## 9. مراحل التنفيذ

### المرحلة 0: تثبيت المرجع والمستودع

- تشغيل نسخة HTML على أجهزة مرجعية.
- التقاط Golden Screenshots لكل شاشة وحالة.
- تسجيل المسافات والألوان والخطوط والظلال.
- تهيئة Git وربطه بالمستودع بعد تنظيف الأسرار.
- حفظ المصدر القديم داخل مجلد مرجعي غير قابل للتعديل أثناء النقل.

شرط الإغلاق: Screen/interaction parity matrix معتمدة.

### المرحلة 1: عقد النظام والأمان

- حسم نموذج ملكية الـID والاستعادة.
- توثيق API وSchemas وحالات الخطأ.
- تصميم Firestore Rules الجديدة.
- تحديد استراتيجية realtime.
- تحديد سياسة الاحتفاظ البعيدة مع بقاء Burn محليًا.
- تحديد مزود الاتصالات وحساباته وWebhooks.

شرط الإغلاق: API contract وSecurity model معتمدان قبل أي ربط إنتاجي.

### المرحلة 2: Scaffold Expo 56

- إنشاء المشروع وExpo Router.
- إعداد bundle/package ID `com.g000st.app`.
- إعداد lint، formatting، typecheck، tests وCI.
- إعداد EAS development/preview/production.
- إعداد configuration آمن دون أسرار داخل التطبيق.

شرط الإغلاق: Development Build يعمل على iOS وAndroid.

### المرحلة 3: المطابقة البصرية

- Design tokens والمكونات المشتركة.
- ID Gate وWelcome.
- Bottom Tabs وShell.
- Chat وContacts وProfile وMobile.
- Social وSocial Chat.
- Modals وkeyboard/safe-area states.

تستخدم Local adapters مؤقتًا في هذه المرحلة لعزل التصميم عن الباك.

شرط الإغلاق: مقارنة screenshots ضمن tolerance متفق عليه.

### المرحلة 4: الهوية والجلسة

- توليد ID وClaim آمن.
- تسجيل الجهاز وإصدار جلسة.
- Restore flow.
- Profile وSecureStore.
- إغلاق Firestore المفتوح بعد التأكد من توافق الويب والإدارة.

شرط الإغلاق: لا يمكن الوصول إلى بيانات مستخدم آخر دون صلاحية.

### المرحلة 5: Chat الفردي

- إنشاء/فتح Conversation بين مستخدمين فقط.
- realtime text.
- Delivered/Read.
- reply/reaction/edit/delete.
- voice/image/file uploads.
- offline queue/retry/idempotency.
- local burn وlocal two-hour cleanup.
- block/report/push.

شرط الإغلاق: سيناريو جهازين ينجح online/offline مع عدم وجود أي غرفة عامة.

### المرحلة 6: Contacts وSocial وSupport

- Contacts وQR والاستيراد.
- Social feed والتفاعلات.
- Social Chat فوق نفس محرك المحادثة الفردية.
- Support tickets والمرفقات.

شرط الإغلاق: لا توجد بيانات demo أو نجاحات وهمية.

### المرحلة 7: الخدمات الهاتفية والدفع

- Number provisioning.
- SMS حقيقي.
- Voice calls حقيقية ونموذج media/call events.
- Stripe native/checkout flow.
- webhook entitlements.
- server-side balance ledger.
- recents وusage من أحداث موثوقة.

شرط الإغلاق: لا يمنح الجهاز رقمًا أو رصيدًا، ولا يخصمه، دون تأكيد السيرفر.

### المرحلة 8: QA والإطلاق

- Unit، integration، contract وE2E tests.
- اختبارات permissions والرفض والانقطاع.
- visual regression.
- اختبار أجهزة iOS وAndroid فعلية.
- performance/memory audit على SDK 56.
- مراجعة Privacy/Terms والادعاءات التسويقية.
- مراجعة الأسرار وFirebase Rules وwebhooks.
- TestFlight وInternal Testing ثم الإطلاق.

## 10. متطلبات بيئة Expo 56

- Node الحالي 22.22.3 مناسب.
- Xcode الحالي 26.3 ويجب تحديثه إلى 26.4 على الأقل لبناء SDK 56 محليًا.
- الحد الأدنى لـiOS في SDK 56 هو 16.4.
- Android يستهدف API 36 ويدعم Android 7+ وفق مرجع Expo.
- سنلتزم بـSDK 56 حسب قرار المشروع، مع اختبار الذاكرة لأن Expo سجلت regression معروفًا في Hermes/Worklets لهذا الإصدار.

## 11. ما يجب توفيره قبل مرحلته

لا تُرسل القيم السرية في المحادثة. يكفي منح الوصول إلى الأنظمة أو وضع القيم داخل Secret Manager/بيئة السيرفر.

- Firebase Console أو exports للقواعد والإعدادات.
- Expo/EAS organization وحسابات Apple/Google عند مرحلة builds.
- Stripe Dashboard test mode وWebhook configuration.
- حساب مزود الاتصالات، الأرقام المتاحة، Messaging Profile وCall Control/WebRTC configuration.
- النصوص القانونية والهوية البصرية وملفات الخط إن وجدت.
- نصوص تجربة حفظ `Recovery ID` والتحذير من فقدانه، وأي سياسة دعم مطلوبة لاستعادة الحساب.

## 12. الضوابط

- لا تُحذف بيانات Firestore الحالية دون Backup وموافقة صريحة.
- لا تُرفع service-account files أو `.env` إلى Git.
- لا توضع مفاتيح Stripe/Telnyx السرية داخل Expo أو Next.js.
- لا يُغيّر الخادم الحي أثناء مرحلة التحليل.
- كل تعديل إنتاجي يمر أولًا عبر staging وrollback plan.
- لا تُستخدم عبارات E2EE أو No Logs أو No Trace قبل أن يثبتها التصميم التقني وسياسة البيانات.

## 13. معايير التنفيذ المعتمدة

### TypeScript والتنسيق

- جميع ملفات التطبيق الجديدة تكون TypeScript (`.ts` و`.tsx`) مع `strict` ومن دون استخدام `any` إلا عند حد خارجي موثق ومحصور.
- يُستخدم **NativeWind stable** عبر `className` كحل `tw` المعتمد في Expo، بدل كتابة `StyleSheet.create` داخل المكونات. لا نستخدم إصدار NativeWind التجريبي، وتُثبّت نسخة متوافقة مع Expo SDK 56 بعد فحص الاعتماديات.
- تبقى design tokens والألوان والمسافات والخطوط مشتركة وقابلة للاستخدام في Expo وNext.js.

### طبقة Axios

- تُفحص البنية الموجودة قبل إنشاء أو تعديل طبقة الاتصال.
- instance مركزي واحد لكل Backend، وملف typed مستقل لكل resource، ولا يُستدعى `axios` مباشرة من screens أو stores.
- يُضبط `baseURL` مرة واحدة لمنع تكرار `/api/v1`، وتُترك حدود الـAPI متطابقة بين الويب والهاتف.
- تخزين جلسة Expo يكون في `SecureStore` وليس `localStorage`، مع refresh آمن يمنع تكرار عدة refresh requests بالتوازي.
- يكتشف Axios `FormData` تلقائيًا ولا يُفرض `Content-Type` يدويًا عند رفع الملفات.
- تُفصل دوال الـAPI العادية عن hooks الخاصة بجلب البيانات، مع أخطاء typed وسياسة موحدة للـtimeout والإلغاء وإعادة المحاولة.
- إرسال الرسائل يستخدم outbox وidempotency؛ لا تُستخدم إعادة المحاولة العمياء في العمليات المالية أو غير القابلة للتكرار.

### تنظيم وتنظيف المكونات

- الشاشة الرئيسية مسؤولة عن layout وwiring فقط.
- تُفصل الحالة والـrefs والhandlers في hooks رفيعة، ويُنقل منطق المجال إلى services/use-cases والدوال النقية إلى utils قابلة للاختبار.
- تُفصل أجزاء JSX القابلة لإعادة الاستخدام إلى مكونات واضحة داخل مجلد الـfeature، مع props typed ومن دون وصول خفي إلى حالة الأب.
- تُستخدم `useCallback` و`useMemo` و`React.memo` عند وجود فائدة فعلية واستقرار للـprops، وتُراجع dependency arrays بدقة.
- لا تبقى imports غير مستخدمة أو inline render functions مزدحمة داخل الشاشة.
- عند تطبيق `/refactor-component` على ملف موجود، يُقرأ كاملًا أولًا ويُحافظ على JSX والتصميم والسلوك، ويُطلب تحديد مسار المكونات المستخرجة إذا لم يكن متفقًا عليه مسبقًا.

### الفورمز والتحقق

- لا يتغير تصميم الحقل أو بنيته عند إضافة validation.
- يظهر حد أحمر ورسالة مرتبطة بالحقل من دون تغيير الخلفية، ويُمسح خطأ الحقل فور بدء المستخدم بالكتابة.
- عند الإرسال يظهر أول خطأ حسب ترتيب الحقول على الشاشة، مع التركيز/التمرير إلى الحقل قدر الإمكان.
- تُفحص كل الحقول المطلوبة، وتكون رسائل الأخطاء موحدة، وتُشارك validation schemas بين الويب والهاتف عندما تتطابق القواعد.
- تُكيّف عناصر HTML الواردة في مهارة `form-input` إلى `TextInput` و`Text` ومكونات React Native، مع نفس السلوك ومن دون تغيير الشكل.

### الكيبورد في Expo

- يُستخدم `react-native-keyboard-controller` و`KeyboardProvider` في جذر التطبيق.
- تستخدم شاشات الفورمز `KeyboardAwareScrollView` بدل جمع `KeyboardAvoidingView` مع `ScrollView`.
- تُختبر كل الحقول، وخصوصًا الأخير، على development builds فعلية في iOS وAndroid؛ هذه الآلية لا تعتمد على Expo Go.
