# توثيق مشروع g000st (شرح شامل ودقيق)

## 1) ما هو هذا المشروع؟
هذا المشروع عبارة عن تطبيق ويب أحادي الصفحة (Single-Page App) باسم g000st، فكرته الأساسية:
- تواصل خاص بين المستخدمين بهوية طويلة (User ID بطول 50 حرف).
- واجهات متعددة داخل نفس التطبيق: Chat, Contacts, ID/Profile, Social, Trading, Mobile, SOS, Support.
- جزء Admin للتحكم في المستخدمين والمحتوى والإعدادات عبر Firebase.
- يعتمد بشكل كبير على localStorage/sessionStorage محليًا، مع مزامنة جزئية عبر Firebase/REST.

المشروع في هذه النسخة عبارة عن ملفين HTML كبيرين فقط:
- appfg000st.html: التطبيق الأساسي الكبير (واجهة + منطق + وحدات كثيرة داخل نفس الملف).
- wweindex.html: نسخة/بناء يتضمن بوابة دخول ID + لوحة Admin + ربط Firebase + جزء React bundled.

---

## 2) ماذا يعمل المشروع عمليًا؟
عمليًا، المستخدم يدخل بهوية g000st (أو ينشئ واحدة)، ثم يتنقل بين أقسام:
- My Page/ID: عرض الهوية، نسخ/مشاركة، إدارة بيانات الملف الشخصي، الصورة والـ cover.
- g000st centre: نشر منشورات قصيرة (نص + صورة)، تفاعل وتعليقات وتعديل/حذف منشورات المستخدم.
- network: استكشاف/بحث مستخدمين عبر SN أو ID، متابعة/إلغاء متابعة، فتح Whisper/Call.
- whisper: محادثات خاصة "ghost-to-ghost".
- g000st trading: نشر عروض بيع وشراء، صورة/سعر/وصف/عنوان، تعليقات وتفاعل وعروض.
- g000st mobile: محاكاة رقم خاص + SMS + دقائق + خطط شراء (logic محلي).
- chat: دردشة مباشرة مع ميزات burn/protect/reply/reactions/voice.
- SOS: أدوات مساعدة طوارئ (GPS, ICE, medical QR, checklists) مع تسجيل محلي.
- support: إرسال رسالة دعم ومحاولة الإرسال عبر FormSubmit/Webhook.

وفي جانب الإدارة (Admin):
- دخول بـ PIN ثابت.
- إحصائيات users/posts/listings.
- ON/OFF flags للأقسام.
- حظر/فك حظر المستخدمين.
- تعديل/حذف posts/listings.
- إرسال رسائل عامة أو لمستخدم محدد.

---

## 3) البنية التقنية (Tech Stack)
### الواجهة
- HTML/CSS/JavaScript في ملف واحد (لا يوجد تقسيم مشروع تقليدي إلى src/components).
- Tailwind utilities موجودة مدمجة/مخرجات build.
- أجزاء React bundled (minified runtime + createRoot + component tree) موجودة داخل الملفات.
- أجزاء Vanilla JS كثيرة أيضًا بنفس الملف (وحدات مستقلة مثل Chat, Social, Contacts...).

### البيانات والتخزين
- Local Storage و Session Storage يستخدمان بكثافة لتخزين الحالة المحلية.
- Firebase Firestore مستخدم للمزامنة والبيانات المشتركة (users/posts/listings/messages/config).
- Cloud Function مستخدمة لتوليد كود ID (generateCode).

### الشبكة/API
- نداءات fetch نحو:
  - /api/send-sms
  - /api/call/init
  - Firebase REST/SDK
  - روابط خارجية مثل maps/qrserver/formsubmit/whatsapp.

---

## 4) الملفات الموجودة ودور كل ملف
## appfg000st.html
ملف ضخم يحتوي:
- CSS طويل جدًا (ثيم فاتح/داكن + social/chat/mobile tweaks).
- DOM رئيسي للتطبيق.
- Script blocks متعددة تمثل "Modules" داخل الملف:
  - config.js
  - store.js
  - utils.js
  - social.js
  - app_core.js
  - chat.js
  - contacts.js
  - sos.js
  - support.js
  - profile.js
  - وغيرها
- في آخر الملف: React bundle/minified code لواجهة كبيرة.

الخلاصة: هو النسخة الكاملة الأساسية التي تجمع كل شيء.

## wweindex.html
يحتوي:
- بوابة ID عند بداية الصفحة (idGate) تطلب "Paste your user ID".
- root رئيسي + admin-root مخفي مبدئيًا.
- لوحة Admin كاملة (PIN + tables + controls + snapshots).
- Firebase SDK imports (modular وcompat في أجزاء مختلفة).
- سكربتات حماية/تصحيح روابط/embedding wrappers.
- جزء React bundled مشابه/مرتبط.

الخلاصة: نسخة تضم تدفق دخول + إدارة + ربط مباشر قوي مع Firestore.

---

## 5) الوحدات الأساسية داخل التطبيق (Functional Modules)
## (A) الهوية وتسجيل الدخول Profile/ID
- هوية المستخدم عبارة عن string بطول 50 حرف.
- وظائف:
  - createId: توليد ID من cloud function (مع fallback GET).
  - pasteId: إدخال ID موجود والتحقق عبر Firestore.
  - copy/share ID.
  - تخزين واسترجاع ID من localStorage.
- توجد عدة مفاتيح تخزين مكررة لنفس الفكرة بسبب التطوير التراكمي.

## (B) Chat
- الرسائل مخزنة محليًا (g000st_msg) مع مزامنة اختيارية.
- ميزات:
  - إرسال نص.
  - رد Swipe-to-reply.
  - Reactions.
  - Edit/Delete لرسائل المستخدم.
  - Burn mode: رسالة "sealed" ثم فتح ثم احتراق 5 ثوان.
  - Auto-expire بعد حوالي 120 دقيقة.
  - Protect mode: blur محتوى الرسائل حتى الضغط.
  - صوت Voice messages (MediaRecorder + fallback) مع waveform وتشغيل.
  - Outbox عند offline ثم flush عند عودة الاتصال.

## (C) Social
- منشورات اجتماعية محلية/شبكية.
- نشر نص + صورة.
- بحث مستخدم بالـ ID/SN.
- صفحة بروفايل (صورة، دولة، عمر، هواية، bio).
- like/comment/share/copy link/edit/delete.
- شبكة "camp" (إضافة/إلغاء).
- Notifications social محلية.

## (D) Contacts
- قائمة جهات اتصال + فلاتر + بحث.
- دمج مع دفتر Mobile المحلي.
- إضافة يدويًا أو من QR أو من phone contacts (حيث مدعوم).
- فتح chat أو calls (صوت/فيديو شكليًا داخل واجهة التطبيق).

## (E) Trading
- إدراج عناصر للبيع (title/desc/price/address/image).
- تعليقات وتفاعل ومتابعة.
- إمكانية edit/delete لصاحب العنصر.
- مزامنة مع Firestore عبر __gfb.saveListing/delListing.

## (F) Mobile
- قسم يحاكي هاتف خاص:
  - dial pad.
  - SMS محلي.
  - مكالمات محسوبة بالدقائق.
  - Plans (مثل sms5/min10/min30).
  - رصيد usage محفوظ محليًا.
- الدفع PaymentRequest مفعّل منطقيًا مع fallback unlock محلي.

## (G) SOS
- ضغط مطول لتفعيل تدفق SOS.
- محاولة أخذ GPS وإرفاقه.
- حفظ logs محليًا + محاولة webhook.
- ICE contacts.
- Medical ID + QR generation.
- checklists ونصائح أجهزة خارجية.

## (H) Support
- رسالة دعم من المستخدم.
- تحفظ local outbox.
- محاولة إرسال عبر API.postWebhook.
- محاولة إرسال عبر FormSubmit إلى supportEmail.

## (I) Admin (في wweindex)
- PIN ثابت داخل الواجهة.
- إدارة:
  - users: block/edit/message.
  - posts: hide/edit/delete.
  - listings: hide/edit/delete.
  - switches flags للأقسام.
  - broadcast أو one-user messages.
- onSnapshot real-time لكل الكوليكشنات.

---

## 6) خدمات خارجية وربط البيانات
## Firebase
- projectId: g000st-9f70c
- يستخدم Firestore collections غالبًا:
  - users
  - posts
  - listings
  - messages
  - config
  - codes

## Endpoints أخرى
- /api/send-sms
- /api/call/init
- Cloud function generateCode
- formsubmit.co
- api.qrserver.com
- WhatsApp/Maps share links

---

## 7) مفاتيح التخزين المحلي (أهمها)
المشروع يحتوي مفاتيح كثيرة جدًا. أهم الأنماط:
- هوية/دخول:
  - g000st-key
  - g000st-in
  - g000st-agreed
  - g000st_user_id
- مظهر وإعدادات:
  - g000st_theme
  - g000st_text_scale
  - g000st_chat_wallpaper
- Chat:
  - g000st_msg
  - g000st_burn
  - g000st_protect
  - g000st_msg_outbox
- Social:
  - g000st_social_posts
  - g000st_social_profile
  - g000st_social_notifs
  - g000st_social_camp
  - g000st_social_peers
- Mobile:
  - g000st_mobile_paid
  - g000st_mobile_plan
  - g000st_mobile_sms
  - g000st_mobile_recents
  - g000st_mobile_book
  - g000st_mobile_sms_left / min_left / used
- SOS/Medical/Support:
  - g000st_gps
  - g000st_sos_log
  - g000st_ice
  - g000st_medical_id
  - g000st_support_outbox

---

## 8) ملاحظات معمارية مهمة
1) المشروع ليس مفصول طبقات بشكل احترافي (frontend architecture تقليدي)، بل ملف واحد كبير جدًا يحتوي كل الطبقات.
2) يوجد مزج بين:
- Vanilla JS modules
- React bundle minified
- Firebase modular + compat
وهذا يشير إلى تطور تراكمي ونسخ دمج متعددة.
3) يوجد تكرار في الدوال/المفاتيح/الأساليب (مثل onProfilePhoto وتعريفات storage مكررة).
4) منطق حساس (مثل PIN admin أو مفاتيح إعدادات) موجود داخل العميل.

---

## 9) تقييم دقة "الادعاءات" داخل الواجهة مقابل الواقع
- الواجهة تستخدم عبارات مثل "no trace" و"no logs" بكثرة.
- فعليًا، يوجد حفظ محلي موسع + Firestore + Webhook + FormSubmit في مسارات متعددة.
- إذن التطبيق ليس عديم الأثر تقنيًا بشكل كامل؛ إنما يجمع بين local-first وبعض المزامنة الشبكية.

---

## 10) كيف تبدأ تشغيله محليًا؟
لأن الملفات HTML مستقلة، يمكن فتحها مباشرة بالمتصفح، لكن:
- بعض الميزات (ميكروفون/بعض APIs) قد تتطلب https أو بيئة سيرفر محلي.
- Firebase/API endpoints تتطلب اتصال فعلي وصلاحية إعدادات.

اقتراح عملي:
- افتح appfg000st.html لمعاينة التطبيق الأساسي.
- افتح wweindex.html لاختبار تدفق البوابة + admin.

---

## 11) أين الباك إند الحقيقي؟ (تم التحقق عبر السيرفرات)
تم فحص السيرفرات الحية مباشرة عبر SSH، والنتيجة:

### السيرفر الأول: g000st-web
- Node backend يعمل عبر PM2 باسم: g000st-web.
- الملف المشغل فعليًا: /root/server.js.
- المنفذ الداخلي للتطبيق: 3000.
- Nginx يستقبل g000st.com و www.g000st.com على 443 SSL، ثم يمرر الطلبات المناسبة إلى Node.

#### أهم المسارات الموجودة في /root/server.js
- POST /generate-code
- POST /check-code
- GET /api/user/:id
- POST /search-user
- POST /create-post
- GET /feed
- GET /api/feed
- GET /page/:code/posts

#### دور Nginx على g000st-web
- Redirect من HTTP إلى HTTPS.
- Proxy لمسارات API (مثل /api/) إلى http://localhost:3000.
- Proxy مباشر لبعض المسارات (مثل /feed و /search-user و /generate-code).
- أي مسار آخر يذهب إلى index.html (نمط SPA fallback).

### السيرفر الثاني: g000st-app
- Node backend يعمل عبر PM2 باسم: g000st-app.
- الملف المشغل فعليًا: /root/unified.js.
- المنفذ الداخلي: 3000.
- Nginx هناك يعمل كـ reverse proxy افتراضي من المنفذ 80 إلى 127.0.0.1:3000.

#### ملاحظة مهمة عن /root/unified.js
- هذا ملف مبسط/مصغر جدًا (واجهة HTML مدمجة داخل السيرفر) وفيه endpoints قليلة مثل:
  - GET /
  - GET /generate-code
  - GET /chat
- يوجد أيضًا /root/server.js أقدم/بديل يعمل بدون Express تقريبًا (HTTP server يدوي)، لكن العملية الجارية حسب PM2 هي unified.js.

### الخلاصة المعمارية للباك إند
1) الباك إند ليس داخل ملفي HTML المحليين فقط، بل موجود فعلًا على سيرفرات Node خارجية.
2) السيرفر الأساسي المرتبط بالدومين العام g000st.com هو g000st-web (Nginx SSL + Node /root/server.js).
3) توجد بيئة أخرى على g000st-app تعمل بخدمة Node منفصلة (غالبًا نسخة/مسار تشغيل مختلف أو تجميعي).
4) Firebase Firestore ما زال جزءًا رئيسيًا من البيانات، لكن هناك REST backend فعلي على Node لمعالجات محددة.

---

## 11) خلاصة نهائية سريعة
هذا المشروع هو "منصة تواصل اجتماعي/دردشة/تداول" بطابع anonymous، مبنية بأسلوب single-file mega HTML، وتدمج:
- هوية مستخدم مشفرة شكلًا (50-char ID)
- دردشة مع burn/protect/voice
- social feed + profiles
- trading listings
- mobile-like calling/SMS simulation
- SOS utilities
- admin panel على Firestore

وهو غني وظيفيًا جدًا، لكنه يحتاج إعادة تنظيم معماري إذا الهدف هو قابلية صيانة عالية وإصدار إنتاجي قوي على المدى الطويل.
