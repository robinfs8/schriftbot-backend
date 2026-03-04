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

app.use(cors());

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

    console.log("✅ Webhook empfangen:", event.type);

    // =============================================================================
    // ERSTKAUF: checkout.session.completed (Tag 1)
    // =============================================================================
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const uid = session.client_reference_id;

      if (!uid) {
        console.error("❌ Keine UID in Checkout Session gefunden");
        return res.json({ received: true });
      }

      try {
        const sessionWithItems = await stripe.checkout.sessions.retrieve(
          session.id,
          { expand: ["line_items.data.price.product"] }
        );

        const product = sessionWithItems.line_items.data[0].price.product;
        const creditsToAdd = parseInt(product.metadata.credits || "0");
        const isUnlimited = product.metadata.isUnlimited === "true";
        const planName = product.metadata.planName || product.name;

        console.log(
          `🌟 ERSTKAUF: User ${uid} → ${creditsToAdd} Credits (${planName})`
        );

        await updateFirestoreUser(uid, {
          creditsToAdd,
          isUnlimited,
          planName,
          subscriptionId: session.subscription,
          customerId: session.customer,
          invoiceId: session.invoice,
          isRenewal: false,
        });
      } catch (err) {
        console.error("❌ Fehler bei Erstkauf:", err);
        console.error("Stack:", err.stack);
      }
    }

    // =============================================================================
    // MONATLICHE VERLÄNGERUNG: invoice.paid
    // =============================================================================
    if (event.type === "invoice.paid") {
      const invoice = event.data.object;

      // Erstkauf ignorieren (dafür hast du checkout.session.completed)
      if (invoice.billing_reason === "subscription_create")
        return res.json({ received: true });

      if (invoice.billing_reason === "subscription_cycle") {
        console.log(`🔄 Verlängerung erkannt für Invoice: ${invoice.id}`);

        try {
          let uid = null;

          // 1. VERSUCH: UID aus Subscription-Metadaten (falls vorhanden)
          if (invoice.subscription) {
            const subscription = await stripe.subscriptions.retrieve(
              invoice.subscription
            );
            uid = subscription.metadata.uid;
          }

          // 2. VERSUCH (DEIN FIX): Suche in Firestore nach der stripeCustomerId
          if (!uid) {
            console.log(
              `🔍 UID nicht in Metadaten. Suche User mit Customer-ID: ${invoice.customer}`
            );

            const userSnapshot = await db
              .collection("users")
              .where("stripeCustomerId", "==", invoice.customer) // Suche nach der ID
              .limit(1)
              .get();

            if (!userSnapshot.empty) {
              uid = userSnapshot.docs[0].id; // Die Dokument-ID ist deine UID
              console.log(
                `✅ User-UID erfolgreich über Customer-ID gefunden: ${uid}`
              );
            }
          }

          // Abbrechen, wenn absolut keine UID gefunden wurde
          if (!uid) {
            console.error(
              `❌ Kritisch: Kein User für Customer ${invoice.customer} in Firestore gefunden.`
            );
            return res.json({ received: true });
          }

          // 3. DATEN ABRECHNEN (Credits etc.)

          const lineItem = invoice.lines.data[0];
          const productId = lineItem?.price?.product || lineItem?.plan?.product;

          if (!productId) {
            console.error(
              "❌ Kein Product gefunden. Line item:",
              JSON.stringify(lineItem)
            );
            return res.json({ received: true });
          }

          const product = await stripe.products.retrieve(productId);
          const creditsToAdd = parseInt(product.metadata.credits || "0");
          const isUnlimited = product.metadata.isUnlimited === "true";
          const planName = product.metadata.planName || product.name;

          // 4. FIRESTORE UPDATE
          await updateFirestoreUser(uid, {
            creditsToAdd,
            isUnlimited,
            planName,
            subscriptionId: invoice.subscription,
            customerId: invoice.customer,
            invoiceId: invoice.id,
            isRenewal: true,
          });
        } catch (err) {
          console.error("❌ Fehler im invoice.paid Flow:", err);
        }
      }
    }

    // =============================================================================
    // ABO GEKÜNDIGT
    // =============================================================================
    if (event.type === "customer.subscription.deleted") {
      const subscription = event.data.object;
      const uid = subscription.metadata.uid;

      console.log(`🚫 ABO GEKÜNDIGT für User: ${uid}`);

      if (uid) {
        try {
          await db.collection("users").doc(uid).set(
            {
              credits: 0,
              isUnlimited: false,
              plan: "expired",
              lastPaymentStatus: "canceled",
              subscriptionEndDate: new Date().toISOString(),
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true }
          );
          console.log(
            `✅ User ${uid}: Zugriff entzogen, Credits auf 0 gesetzt`
          );
        } catch (err) {
          console.error("❌ Firestore Error (subscription.deleted):", err);
        }
      }
    }

    // =============================================================================
    // ZAHLUNG FEHLGESCHLAGEN
    // =============================================================================
    if (event.type === "invoice.payment_failed") {
      const invoice = event.data.object;

      try {
        if (!invoice.subscription) return res.json({ received: true });

        const subscription = await stripe.subscriptions.retrieve(
          invoice.subscription
        );
        const uid = subscription.metadata.uid;

        console.log(`⚠️ ZAHLUNG FEHLGESCHLAGEN für User: ${uid}`);

        if (uid) {
          await db.collection("users").doc(uid).set(
            {
              lastPaymentStatus: "past_due",
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true }
          );
          console.log(`⚠️ User ${uid}: Status auf "past_due" gesetzt`);
        }
      } catch (err) {
        console.error("❌ Fehler bei payment_failed:", err);
      }
    }

    res.json({ received: true });
  }
);

// =============================================================================
// HILFSFUNKTION: Firestore Update mit Idempotenz & Credit-Addition
// =============================================================================
async function updateFirestoreUser(uid, data) {
  const userRef = db.collection("users").doc(uid);

  // Idempotenz-Check: Wurde diese Rechnung schon verarbeitet?
  const doc = await userRef.get();
  if (
    doc.exists &&
    doc.data().payments?.some((p) => p.invoiceId === data.invoiceId)
  ) {
    console.log(`⚠️ Invoice ${data.invoiceId} bereits verarbeitet - ABBRUCH`);
    return;
  }

  const currentData = doc.exists ? doc.data() : {};
  const currentCredits = currentData.credits || 0;

  // Bei Unlimited: Immer 999999
  // Bei Limited: Credits ADDIEREN (wichtig für Verlängerung!)
  const newCredits = data.isUnlimited
    ? 999999
    : currentCredits + data.creditsToAdd;

  console.log(
    `📊 Credits: ${currentCredits} + ${data.creditsToAdd} = ${newCredits}`
  );

  await userRef.set(
    {
      credits: newCredits,
      isUnlimited: data.isUnlimited,
      plan: data.planName,
      lastPaymentStatus: "active",
      subscriptionId: data.subscriptionId,
      stripeCustomerId: data.customerId,
      lastRenewalDate: new Date().toISOString(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      payments: admin.firestore.FieldValue.arrayUnion({
        invoiceId: data.invoiceId,
        credits: data.creditsToAdd,
        isRenewal: data.isRenewal,
        date: new Date().toISOString(),
        status: "completed",
      }),
    },
    { merge: true }
  );

  console.log(
    `✅ Firestore aktualisiert: User ${uid} hat jetzt ${newCredits} Credits`
  );
}

// =============================================================================
// JSON MIDDLEWARE
// =============================================================================
app.use(express.json());

// =============================================================================
// CHECKOUT SESSION ERSTELLEN
// =============================================================================
app.post("/create-checkout-session", async (req, res) => {
  try {
    console.log("📥 Checkout Request:", req.body);
    const { uid, email, priceId } = req.body;

    // 1. Validierung
    if (!priceId || !uid || !email) {
      console.error("❌ Fehlende Daten:", { priceId, uid, email });
      return res.status(400).json({ error: "Fehlende Daten für den Checkout" });
    }

    // 2. Bestimmen, ob es ein Abo oder eine Einmalzahlung ist
    // Wir listen hier die IDs der Abos auf. Alles andere wird als "payment" (Einmal) behandelt.
    const subscriptionPriceIds = [
      "price_1SoLNO49gql0qC52Y0vVUK5W", // Basic Abo
      "price_1SqFid49gql0qC52OCgqnpsf", // Pass Abo
      "price_1SnmIw49gql0qC520ajSTJ5d", // Unlimited Abo
    ];

    const isSubscription = subscriptionPriceIds.includes(priceId);
    const mode = isSubscription ? "subscription" : "payment";

    // 3. Session Konfiguration
    const sessionOptions = {
      line_items: [{ price: priceId, quantity: 1 }],
      mode: mode,
      customer_email: email,
      client_reference_id: uid, // Wichtig für den Webhook (Identifikation)
      success_url: `https://schriftbot.com/success`,
      cancel_url: `https://schriftbot.com/`,
      metadata: { uid }, // Metadata auf Session-Ebene (für beide Modi)
    };

    // 4. Spezifische Daten je nach Modus hinzufügen
    if (isSubscription) {
      sessionOptions.subscription_data = {
        metadata: { uid }, // Wichtig für Subscriptions
      };
    } else {
      sessionOptions.payment_intent_data = {
        metadata: { uid }, // Wichtig für Einmalzahlungen
      };
    }

    // 5. Stripe Session erstellen
    const session = await stripe.checkout.sessions.create(sessionOptions);

    console.log(`✅ ${mode.toUpperCase()} Session erstellt:`, session.id);
    res.json({ url: session.url });
  } catch (err) {
    console.error("❌ Checkout Error:", err);
    res.status(500).json({ error: "Interner Server-Fehler: " + err.message });
  }
});

// Endpunkt zum Vorbereiten der Löschung (Stripe & Firestore)
app.post("/delete-user-data", async (req, res) => {
  const { uid } = req.body; // In Produktion: Nutze ID-Token Verifizierung!

  try {
    const userRef = db.collection("users").doc(uid);
    const userDoc = await userRef.get();

    if (userDoc.exists) {
      const userData = userDoc.data();

      // 1. Stripe-Kunde löschen (beendet sofort alle Abos)
      if (userData.stripeCustomerId) {
        try {
          await stripe.customers.del(userData.stripeCustomerId);
          console.log(`Stripe Customer ${userData.stripeCustomerId} gelöscht.`);
        } catch (stripeErr) {
          console.error("Stripe Fehler beim Löschen:", stripeErr);
          // Wir machen trotzdem weiter, falls der Kunde bei Stripe nicht existiert
        }
      }

      // 2. Firestore-Daten löschen
      await userRef.delete();
      console.log(`Firestore Daten für ${uid} gelöscht.`);
    }

    res.json({ success: true });
  } catch (err) {
    console.error("Löschfehler:", err);
    res.status(500).json({ error: "Fehler beim Bereinigen der Daten" });
  }
});

// =============================================================================
// HEALTH CHECK
// =============================================================================
app.get("/", (req, res) =>
  res.json({ status: "active", timestamp: new Date().toISOString() })
);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server läuft auf Port ${PORT}`));
