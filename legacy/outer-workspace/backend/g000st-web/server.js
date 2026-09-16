const express = require('express');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const path = require('path');
const cors = require('cors');
const Stripe = require('stripe');

const app = express();
app.use(cors());
const jsonParser = express.json();
app.use((req, res, next) => {
  if (req.originalUrl.startsWith('/stripe/webhook')) return next();
  return jsonParser(req, res, next);
});
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'g000st-package', 'public')));

const serviceAccount = require('./firebase-key.json');
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const stripeSecretKey = process.env.STRIPE_SECRET_KEY || '';
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';
const stripePublishableKey = process.env.STRIPE_PUBLISHABLE_KEY || '';
const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null;

const PLAN_CONFIG = {
  sms: { key: 'sms', name: '5 SMS', amount: 500, currency: 'gbp', days: 30 },
  voice10: { key: 'voice10', name: '10 Minutes Voice', amount: 1000, currency: 'gbp', days: 30 },
  voice30: { key: 'voice30', name: '30 Minutes Voice', amount: 2500, currency: 'gbp', days: 30 },
};

function resolvePlan(planKey) {
  return PLAN_CONFIG[planKey] || PLAN_CONFIG.sms;
}

function appBaseUrl(req) {
  if (process.env.APP_BASE_URL) return process.env.APP_BASE_URL.replace(/\/$/, '');
  const proto = req.headers['x-forwarded-proto'] || req.protocol || 'http';
  return `${proto}://${req.get('host')}`;
}

async function activateSubscription({ code, plan, session }) {
  const now = Date.now();
  const activeUntilMs = now + plan.days * 24 * 60 * 60 * 1000;
  const activeUntil = new Date(activeUntilMs).toISOString();
  const subscriptionData = {
    status: 'active',
    provider: 'stripe',
    plan: plan.key,
    planName: plan.name,
    amount: plan.amount,
    currency: plan.currency,
    activeFrom: new Date(now).toISOString(),
    activeUntil,
    sessionId: session.id,
    paymentIntent: session.payment_intent || null,
    customerEmail: (session.customer_details && session.customer_details.email) || null,
    updatedAt: FieldValue.serverTimestamp(),
  };

  await db.collection('subscriptions').doc(session.id).set({
    ...subscriptionData,
    code: code || null,
    createdAt: FieldValue.serverTimestamp(),
  });

  if (code && String(code).length >= 20) {
    await Promise.all([
      db.collection('codes').doc(code).set({ subscription: subscriptionData }, { merge: true }),
      db.collection('pages').doc(code).set({ subscription: subscriptionData }, { merge: true }),
    ]);
  }
}

app.get('/api/stripe/config', (req, res) => {
  res.json({
    ok: true,
    publishableKey: stripePublishableKey || null,
    enabled: Boolean(stripeSecretKey),
  });
});

app.get('/stripe-checkout', async (req, res) => {
  try {
    if (!stripe) return res.status(500).send('Stripe is not configured');
    const plan = resolvePlan(String(req.query.plan || 'sms'));
    const code = String(req.query.code || '').trim() || null;
    const baseUrl = appBaseUrl(req);
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      success_url: `${baseUrl}/?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/?payment=cancel`,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: plan.currency,
            unit_amount: plan.amount,
            product_data: {
              name: `g000st mobile · ${plan.name}`,
              description: `One-time payment · valid ${plan.days} days`,
            },
          },
        },
      ],
      metadata: {
        plan: plan.key,
        validityDays: String(plan.days),
        code: code || '',
      },
      payment_intent_data: {
        metadata: {
          plan: plan.key,
          code: code || '',
        },
      },
      allow_promotion_codes: true,
    });

    return res.redirect(303, session.url);
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
});

app.post('/api/stripe/create-checkout', async (req, res) => {
  try {
    if (!stripe) return res.status(500).json({ ok: false, error: 'Stripe is not configured' });
    const plan = resolvePlan(String(req.body.plan || 'sms'));
    const code = String(req.body.code || '').trim() || null;
    const baseUrl = appBaseUrl(req);
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      success_url: `${baseUrl}/?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/?payment=cancel`,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: plan.currency,
            unit_amount: plan.amount,
            product_data: {
              name: `g000st mobile · ${plan.name}`,
              description: `One-time payment · valid ${plan.days} days`,
            },
          },
        },
      ],
      metadata: {
        plan: plan.key,
        validityDays: String(plan.days),
        code: code || '',
      },
      payment_intent_data: {
        metadata: {
          plan: plan.key,
          code: code || '',
        },
      },
      allow_promotion_codes: true,
    });

    return res.json({ ok: true, id: session.id, url: session.url });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
});

app.post('/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    if (!stripe || !stripeWebhookSecret) {
      return res.status(500).send('Stripe webhook is not configured');
    }

    const signature = req.headers['stripe-signature'];
    if (!signature) return res.status(400).send('Missing stripe-signature header');

    const event = stripe.webhooks.constructEvent(req.body, signature, stripeWebhookSecret);
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      if (session.payment_status === 'paid') {
        const plan = resolvePlan(String((session.metadata && session.metadata.plan) || 'sms'));
        const code = (session.metadata && session.metadata.code) || null;
        await activateSubscription({ code, plan, session });
      }
    }

    return res.status(200).json({ received: true });
  } catch (e) {
    return res.status(400).send(`Webhook error: ${e.message}`);
  }
});

function generateCode(length = 50) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
  return result;
}

// توليد كود
app.post('/generate-code', async (req, res) => {
  try {
    const { hwid } = req.body;
    const code = generateCode(50);
    const data = { hwid: hwid || null, createdAt: FieldValue.serverTimestamp(), valid: true, name: `g000st ${code.substring(0,8)}` };
    await db.collection('codes').doc(code).set(data);
    await db.collection('pages').doc(code).set(data);
    return res.json({ valid: true, code });
  } catch (e) { return res.status(500).json({ valid: false, error: e.message }); }
});

app.post('/check-code', async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return res.json({ valid: false });
    const doc = await db.collection('codes').doc(code).get();
    if (!doc.exists) return res.json({ valid: false });
    return res.json({ valid: true, data: doc.data() });
  } catch (e) { return res.json({ valid: false }); }
});

// هاد اللي ناقص - يخلي app.js القديم يشتغل مع الجديد
app.get('/api/user/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const name = req.query.name;
    let doc = await db.collection('pages').doc(id).get();
    if (!doc.exists) doc = await db.collection('codes').doc(id).get();
    if (!doc.exists && name) {
      const data = { name, createdAt: FieldValue.serverTimestamp(), valid: true };
      await db.collection('pages').doc(id).set(data);
      await db.collection('codes').doc(id).set(data);
      doc = await db.collection('pages').doc(id).get();
    }
    if (!doc.exists) return res.json({ ok: false });
    return res.json({ ok: true, id: doc.id, ...doc.data() });
  } catch (e) { return res.json({ ok: false, error: e.message }); }
});

// البحث الموحد - تطبيق يشوف ويب
app.post('/search-user', async (req, res) => {
  try {
    const query = req.body.code || req.body.q;
    if (!query) return res.json({ found: false });
    let doc = await db.collection('pages').doc(query).get();
    if (!doc.exists) doc = await db.collection('codes').doc(query).get();
    if (!doc.exists) return res.json({ found: false });
    return res.json({ found: true, id: doc.id, ...doc.data() });
  } catch (e) { return res.json({ found: false }); }
});

app.post('/create-post', async (req, res) => {
  try {
    const { code, content, title } = req.body;
    if (!code || !content) return res.status(400).json({ ok: false });
    const postRef = await db.collection('posts').add({
      pageId: code, content, title: title || '', createdAt: FieldValue.serverTimestamp(), likes: 0
    });
    return res.json({ ok: true, postId: postRef.id });
  } catch (e) { return res.status(500).json({ ok: false }); }
});

// الصفحة الرئيسية الموحدة - ويب + تطبيق بنفس المكان
async function getFeed(req,res){
  try {
    const snap = await db.collection('posts').orderBy('createdAt', 'desc').limit(100).get();
    const posts = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    return res.json({ ok: true, posts });
  } catch (e) { return res.json({ ok: false, posts: [] }); }
}
app.get('/feed', getFeed);
app.get('/api/feed', getFeed);

app.get('/page/:code/posts', async (req, res) => {
  try {
    const snap = await db.collection('posts').where('pageId', '==', req.params.code).orderBy('createdAt','desc').limit(50).get();
    return res.json({ ok: true, posts: snap.docs.map(d=>({id:d.id,...d.data()})) });
  } catch(e){ return res.json({ ok:false, posts:[] }); }
});

const PORT = Number(process.env.PORT || 3000);
app.listen(PORT, () => console.log(`✅ Server running on ${PORT} - Unified feed ready`));
