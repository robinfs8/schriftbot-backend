require("dotenv").config();
const express = require("express");
const cors = require("cors");
const Stripe = require("stripe");
const admin = require("firebase-admin");

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const app = express();

// --- 1. FIREBASE INITIALISIERUNG ---
const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT
  ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
  : require("./serviceAccountKey.json");

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}
const db = admin.firestore();

// ✅ CORS FÜR ALLE ORIGINS ERLAUBEN (für Entwicklung)
app.use(cors());

// Alternativ: Nur spezifische Origins
// app.use(cors({
//   origin: ['https://schriftbot.com', 'http://localhost:3000', 'http://localhost:3001'],
//   credentials: true
// }));

// --- 2. WEBHOOK ENDPOINT ---
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
      console.error(`❌ Webhook Signatur Fehler: ${err.message}`);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === "invoice.paid") {
      const invoice = event.data.object;

      if (!invoice.subscription) {
        return res.json({ received: true });
      }

      try {
        const subscription = await stripe.subscriptions.retrieve(
          invoice.subscription
        );
        const uid = subscription.metadata.uid;

        if (!uid) {
          console.error(`⚠️ Keine UID in Subscription ${invoice.subscription}`);
          return res.json({
            status: "error",
            message: "UID missing in metadata",
          });
        }

        const subscriptionItem = subscription.items.data[0];
        const product = await stripe.products.retrieve(
          subscriptionItem.price.product
        );

        const credits = parseInt(product.metadata.credits || "0");
        const isUnlimited = product.metadata.isUnlimited === "true";
        const planName = product.metadata.planName || product.name;

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
              stripeCustomerId: invoice.customer,
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true }
          );

        console.log(
          `✅ User ${uid}: ${credits} Credits (${planName}) vergeben`
        );
      } catch (err) {
        console.error("❌ Firestore Error:", err);
        return res.status(500).send("Internal Server Error");
      }
    }

    if (event.type === "customer.subscription.deleted") {
      const subscription = event.data.object;
      const uid = subscription.metadata.uid;

      if (uid) {
        try {
          await db.collection("users").doc(uid).set(
            {
              credits: 0,
              isUnlimited: false,
              plan: "expired",
              lastPaymentStatus: "canceled",
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true }
          );
          console.log(`🚫 Abo für User ${uid} beendet`);
        } catch (err) {
          console.error("❌ Firestore Error:", err);
        }
      }
    }

    res.json({ received: true });
  }
);

// --- 3. JSON MIDDLEWARE (NACH Webhook!) ---
app.use(express.json());

// --- 4. CHECKOUT SESSION ---
app.post("/create-checkout-session", async (req, res) => {
  try {
    console.log("📥 Checkout Request:", req.body);

    const { uid, email, priceId } = req.body;

    if (!priceId) {
      console.error("❌ Fehlende priceId");
      return res.status(400).json({ error: "Fehlende Price ID" });
    }

    if (!uid || !email) {
      console.error("❌ Fehlende uid oder email");
      return res.status(400).json({ error: "Fehlende User-Daten" });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer_email: email,
      client_reference_id: uid,
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: {
        metadata: { uid },
      },
      success_url: `https://schriftbot.com/success`,
      cancel_url: `https://schriftbot.com/`,
    });

    console.log("✅ Session erstellt:", session.id);
    res.json({ url: session.url });
  } catch (err) {
    console.error("❌ Checkout Error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.get("/", (req, res) => res.json({ status: "active" }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server läuft auf Port ${PORT}`));
