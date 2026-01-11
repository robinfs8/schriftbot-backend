require("dotenv").config();
const express = require("express");
const cors = require("cors");
const Stripe = require("stripe");
const admin = require("firebase-admin");

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const app = express();

// 1. Firebase Admin
const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT
  ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
  : require("./serviceAccountKey.json");

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}
const db = admin.firestore();

app.use(cors());

// --- 2. STRIPE WEBHOOK ---
app.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const sig = req.headers["stripe-signature"];
    let event;

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.error(`❌ Webhook Fehler: ${err.message}`);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // LOGIK: Jedes Mal wenn eine Rechnung bezahlt wurde (Erstkauf + Verlängerung)
    if (event.type === "invoice.paid") {
      const invoice = event.data.object;

      try {
        // Subscription abrufen
        const subscription = await stripe.subscriptions.retrieve(
          invoice.subscription
        );
        const { uid } = subscription.metadata;

        if (!uid) {
          console.error("❌ Keine UID in Subscription Metadata");
          return res.json({ received: true });
        }

        // Price-Objekt abrufen um Product zu bekommen
        const priceId = subscription.items.data[0].price.id;
        const price = await stripe.prices.retrieve(priceId);

        // Product-Metadaten abrufen (HIER LIEGT DIE LOGIK!)
        const product = await stripe.products.retrieve(price.product);
        const metadata = product.metadata;

        // Metadaten auslesen (mit Fallback-Werten)
        const credits = parseInt(metadata.credits || "0");
        const isUnlimited = metadata.isUnlimited === "true";
        const planName = metadata.planName || product.name;

        // Firestore Update
        await db
          .collection("users")
          .doc(uid)
          .set(
            {
              credits: isUnlimited ? 999999 : credits,
              isUnlimited: isUnlimited,
              plan: planName,
              lastPaymentStatus: "active",
              subscriptionId: invoice.subscription,
              lastBillingDate: new Date().toISOString(),
            },
            { merge: true }
          );

        console.log(
          `✅ User ${uid}: ${credits} Credits vergeben (${planName})`
        );
      } catch (err) {
        console.error("❌ Firestore Error in Webhook:", err);
      }
    }

    // LOGIK: Wenn das Abo abläuft oder gekündigt wird
    if (event.type === "customer.subscription.deleted") {
      const subscription = event.data.object;
      const { uid } = subscription.metadata;

      if (uid) {
        await db.collection("users").doc(uid).set(
          {
            credits: 0,
            isUnlimited: false,
            plan: "expired",
            lastPaymentStatus: "canceled",
          },
          { merge: true }
        );
        console.log(`🚫 Abo für User ${uid} beendet. Credits auf 0 gesetzt.`);
      }
    }

    res.json({ received: true });
  }
);

// --- 3. MIDDLEWARE FÜR JSON (Nach Webhook!) ---
app.use(express.json());

// --- 4. CHECKOUT SESSION ENDPOINT (Nimmt priceId direkt) ---
app.post("/create-checkout-session", async (req, res) => {
  try {
    const { uid, email, priceId } = req.body; // Frontend sendet priceId

    if (!priceId) {
      return res.status(400).json({ error: "Fehlende Price ID" });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer_email: email,
      client_reference_id: uid,
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: {
        metadata: { uid }, // Nur UID, Rest kommt von Stripe
      },
      success_url: `https://schriftbot.com/success`,
      cancel_url: `https://schriftbot.com/`,
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error("❌ Checkout Error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.get("/", (req, res) => res.json({ status: "active" }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server läuft auf Port ${PORT}`));
