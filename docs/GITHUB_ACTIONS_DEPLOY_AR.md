# النشر اليدوي إلى staging عبر GitHub Actions

ملف الـworkflow هو `.github/workflows/deploy-staging.yml`. يتيح نشر `web` أو `api` أو كليهما،
ويعمل على فرع `main` فقط. جميع المسارات والخدمات المستهدفة تخص staging ولا تمس نسخة الإنتاج.

## إعداد GitHub مرة واحدة

من صفحة المستودع افتح:

`Settings` → `Environments` → `New environment`

أنشئ Environment باسم `staging` بالضبط، ثم أضف القيم التالية ضمن **Environment secrets**:

| الاسم | القيمة |
| --- | --- |
| `DEPLOY_SSH_HOST` | عنوان سيرفر staging |
| `DEPLOY_SSH_USER` | اسم مستخدم النشر المقيّد |
| `DEPLOY_SSH_PRIVATE_KEY` | كامل محتوى المفتاح الخاص المخصص للـAction |
| `DEPLOY_SSH_KNOWN_HOSTS` | هوية SSH الموثوقة لسيرفر staging |

وأضف ضمن **Environment variables**:

| الاسم | القيمة |
| --- | --- |
| `DEPLOY_SSH_PORT` | `22` |

تُحفظ ملفات المفتاح والـknown hosts محليًا خارج الريبو. يمكن نسخ قيمة أي ملف إلى الحافظة دون
عرضها في الطرفية:

```bash
pbcopy < /path/to/the/secret-file
```

لا ترفع المفتاح الخاص إلى Git ولا ترسله في المحادثات. يفضّل تفعيل Required reviewers للبيئة،
وقصر Deployment branches على `main`.

## تشغيل النشر

من `Actions` اختر `Deploy staging` ثم `Run workflow`، واختر `web` أو `api` أو `both`.
في حالة `both` يُنشر الباك أولًا ثم الويب. يفحص السكربت صحة الخدمة بعد كل نشر، ويعيد الإصدار
السابق تلقائيًا إذا فشل البناء أو فحص الصحة.
