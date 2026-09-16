# تشغيل الباك إند محليًا (g000st)

## ماذا تم سحبه
تم سحب باك إند من السيرفرين إلى:
- backend/g000st-web
- backend/g000st-app

## تثبيت الاعتماديات
نفذ مرة واحدة:

```bash
cd backend/g000st-web && npm ci
cd ../g000st-app && npm ci
```

## تشغيل الخدمات محليًا
شغل كل خدمة في terminal منفصل:

```bash
PORT=3001 node backend/g000st-web/server.js
PORT=3002 node backend/g000st-app/unified.js
PORT=3003 node backend/g000st-app/server.js
```

## الخدمات والمنافذ
- 3001: backend الأساسي (نسخة g000st-web)
- 3002: unified backend من g000st-app
- 3003: legacy backend من g000st-app

## ملاحظات مهمة
- ملفات حساسة مثل firebase-key.json موجودة محليًا الآن.
- لا ترفع هذه الملفات إلى GitHub العام.
- يفضّل إضافة ignore قبل أي commit.

## اختبار سريع

```bash
curl -s http://127.0.0.1:3001/feed
curl -s -X POST http://127.0.0.1:3001/generate-code -H 'Content-Type: application/json' -d '{}'
curl -s http://127.0.0.1:3002/generate-code
curl -s http://127.0.0.1:3003/health
```
