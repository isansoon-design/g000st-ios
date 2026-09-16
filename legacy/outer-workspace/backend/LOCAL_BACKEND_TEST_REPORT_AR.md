# تقرير اختبار الباك إند المحلي

التاريخ: 2026-09-12

## البيئة
- الجهاز: macOS
- مسار المشروع: /Users/moudy/Desktop/g000st
- خدمات قيد الاختبار:
  - backend/g000st-web/server.js على 3001
  - backend/g000st-app/unified.js على 3002
  - backend/g000st-app/server.js على 3003

## النتائج (Pass/Fail)
1. g000st-web GET /feed: PASS
- أعاد JSON يحتوي ok=true وقائمة posts.

2. g000st-web POST /generate-code: PASS
- أعاد code بطول 50.

3. g000st-web POST /check-code: PASS
- تحقق من الكود المُنشأ وأعاد valid=true.

4. g000st-app (unified) GET /generate-code: PASS
- أعاد code صحيح.

5. g000st-app (unified) GET /chat: PASS
- status=200.

6. g000st-app (legacy) GET /health: PASS
- أعاد {ok:true,count:0}.

7. g000st-app (legacy) POST /generate-code + POST /check-code: PASS
- تم إنشاء كود بطول 50 والتحقق منه بنجاح.

## ملاحظات مخاطر متبقية
- لم تُختبر كل تدفقات الواجهة end-to-end بعد (chat/social/mobile/admin).
- لم تُختبر صلاحيات الموبايل الفعلية (microphone/location/share) بعد.
- لم يتم بعد اختبار Android/iOS WebView compatibility.

## الحالة الحالية
- الباك إند أصبح قابلًا للتشغيل محليًا.
- smoke tests الأساسية ناجحة.
