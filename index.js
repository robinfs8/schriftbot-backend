require("dotenv").config();
const express = require("express");
const cors = require("cors");
const Stripe = require("stripe");
const admin = require("firebase-admin");

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const app = express();

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

// --- 2. WEBHOOK ENDPOINT (VOR express.json!) ---
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

    // --- LOGIK FÜR ZAHLUNGEN (Abos) ---
    if (event.type === "invoice.paid") {
      const invoice = event.data.object;

      // Falls es kein Abo ist, ignorieren
      if (!invoice.subscription) return res.json({ received: true });

      try {
        // 1. UID finden (Wichtig: kommt aus subscription_details)
        const uid = invoice.subscription_details?.metadata?.uid;

        if (!uid) {
          console.error(`⚠️ Keine UID gefunden in Invoice ${invoice.id}`);
          return res.json({ received: true });
        }

        // 2. Produktdaten holen (für Credits & Unlimited Status)
        const lineItem = invoice.lines.data[0];
        const product = await stripe.products.retrieve(lineItem.price.product);

        // Hier lesen wir die Metadaten aus, die DU in Stripe beim Produkt einträgst:
        const creditsToAdd = parseInt(product.metadata.credits || "0");
        const isUnlimited = product.metadata.isUnlimited === "true";
        const planName = product.metadata.planName || product.name;

        console.log(
          `Fulfilling: User ${uid} | Plan ${planName} | Credits ${creditsToAdd}`
        );

        // 3. Firestore Update (Genau wie in deinem alten funktionierenden Code)
        const userRef = db.collection("users").doc(uid);

        await userRef.set(
          {
            // Wenn Unlimited, dann fixe hohe Zahl, sonst addieren
            credits: isUnlimited
              ? 999999
              : admin.firestore.FieldValue.increment(creditsToAdd),
            isUnlimited: isUnlimited,
            plan: planName,
            lastPaymentStatus: "active",
            subscriptionId: invoice.subscription,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            // Zahlungshistorie
            payments: admin.firestore.FieldValue.arrayUnion({
              sessionId: invoice.id,
              amount: invoice.amount_paid / 100,
              credits: creditsToAdd,
              date: new Date().toISOString(),
              status: "completed",
            }),
          },
          { merge: true }
        );

        console.log(`✅ Firestore für User ${uid} erfolgreich aktualisiert.`);
      } catch (err) {
        console.error("❌ Fehler bei Firestore Update:", err);
        return res.status(500).send("Internal Server Error");
      }
    }

    // --- LOGIK FÜR KÜNDIGUNGEN ---
    if (event.type === "customer.subscription.deleted") {
      const subscription = event.data.object;
      const uid = subscription.metadata.uid;

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
        console.log(`🚫 Abo beendet für ${uid}`);
      }
    }

    res.json({ received: true });
  }
);

app.use(express.json());

// --- 4. CHECKOUT SESSION ERSTELLEN ---
app.post("/create-checkout-session", async (req, res) => {
  try {
    const { uid, email, priceId } = req.body;

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer_email: email,
      client_reference_id: uid, // Damit es im Webhook findbar ist
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: {
        metadata: { uid }, // Schreibt die UID direkt in das Abo-Objekt
      },
      success_url: `https://schriftbot.com/success`,
      cancel_url: `https://schriftbot.com/`,
    });

    res.json({ url: session.url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server läuft auf Port ${PORT}`));
