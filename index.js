import express from "npm:express";
import cors from "npm:cors";
import Stripe from "npm:stripe";
import admin from "npm:firebase-admin";

// --- 1. FIREBASE INITIALISIERUNG ---
let db;

try {
  const serviceAccountVar = Deno.env.get("FIREBASE_SERVICE_ACCOUNT");
  if (!serviceAccountVar)
    throw new Error("Umgebungsvariable FIREBASE_SERVICE_ACCOUNT fehlt!");

  const serviceAccount = JSON.parse(serviceAccountVar);
  if (serviceAccount.private_key) {
    serviceAccount.private_key = serviceAccount.private_key.replace(
      /\\n/g,
      "\n"
    );
  }

  if (admin.apps.length === 0) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    console.log("✅ Firebase App erfolgreich initialisiert");
  }
  db = admin.firestore();
} catch (error) {
  console.error("❌ Kritischer Fehler bei Firebase-Init:", error.message);
}

// --- 2. STRIPE & EXPRESS SETUP ---
const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY"));
const app = express();
app.use(cors());

// --- 3. STRIPE WEBHOOK ---
app.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const sig = req.headers["stripe-signature"];
    let event;

    try {
      event = await stripe.webhooks.constructEventAsync(
        req.body,
        sig,
        Deno.env.get("STRIPE_WEBHOOK_SECRET")
      );
    } catch (err) {
      console.error(`❌ Webhook Signatur Fehler: ${err.message}`);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    console.log(`🔔 Event erhalten: ${event.type}`);

    try {
      // ERSTKAUF
      if (event.type === "checkout.session.completed") {
        const session = event.data.object;
        const uid = session.client_reference_id;
        console.log(`🔍 Checkout Session für UID: ${uid}`);

        if (uid) {
          const sessionWithItems = await stripe.checkout.sessions.retrieve(
            session.id,
            { expand: ["line_items.data.price.product"] }
          );

          const product = sessionWithItems.line_items.data[0].price.product;
          const creditsToAdd = parseInt(product.metadata.credits || "0");
          const isUnlimited = product.metadata.isUnlimited === "true";
          const planName = product.metadata.planName || product.name;

          console.log(
            `🚀 Starte Firestore Update für User ${uid} (+${creditsToAdd} Credits)`
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
        }
      }

      // MONATLICHE VERLÄNGERUNG
      if (event.type === "invoice.paid") {
        const invoice = event.data.object;
        if (invoice.billing_reason === "subscription_cycle") {
          const subscription = await stripe.subscriptions.retrieve(
            invoice.subscription
          );
          const uid = subscription.metadata.uid;
          console.log(`🔍 Verlängerung für UID: ${uid}`);

          if (uid) {
            const product = await stripe.products.retrieve(
              invoice.lines.data[0].price.product
            );
            await updateFirestoreUser(uid, {
              creditsToAdd: parseInt(product.metadata.credits || "0"),
              isUnlimited: product.metadata.isUnlimited === "true",
              planName: product.metadata.planName || product.name,
              subscriptionId: invoice.subscription,
              customerId: invoice.customer,
              invoiceId: invoice.id,
              isRenewal: true,
            });
          }
        }
      }

      // KÜNDIGUNG
      if (event.type === "customer.subscription.deleted") {
        const subscription = event.data.object;
        const uid = subscription.metadata.uid;
        if (uid) {
          console.log(`🚫 Abo-Kündigung für UID: ${uid}`);
          await db.collection("users").doc(uid).set(
            {
              credits: 0,
              isUnlimited: false,
              plan: "expired",
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true }
          );
        }
      }
    } catch (processErr) {
      console.error(
        "❌ Fehler bei der Webhook-Verarbeitung:",
        processErr.message
      );
    }

    // Wichtig: Erst antworten, wenn alle Awaits durch sind!
    res.json({ received: true });
  }
);

// --- 4. HILFSFUNKTION (Mit mehr Logs) ---
async function updateFirestoreUser(uid, data) {
  if (!db) {
    console.error("❌ Firestore DB nicht initialisiert!");
    return;
  }

  try {
    const userRef = db.collection("users").doc(uid);
    const doc = await userRef.get();

    // Idempotenz-Check
    if (
      doc.exists &&
      doc.data().payments?.some((p) => p.invoiceId === data.invoiceId)
    ) {
      console.log(`⚠️ Rechnung ${data.invoiceId} wurde bereits verarbeitet.`);
      return;
    }

    const currentCredits = doc.exists ? doc.data().credits || 0 : 0;
    const newCredits = data.isUnlimited
      ? 999999
      : currentCredits + data.creditsToAdd;

    await userRef.set(
      {
        credits: newCredits,
        isUnlimited: data.isUnlimited,
        plan: data.planName,
        lastPaymentStatus: "active",
        stripeCustomerId: data.customerId,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        payments: admin.firestore.FieldValue.arrayUnion({
          invoiceId: data.invoiceId,
          credits: data.creditsToAdd,
          date: new Date().toISOString(),
        }),
      },
      { merge: true }
    );

    console.log(
      `✅ Firestore für User ${uid} erfolgreich aktualisiert. Neue Credits: ${newCredits}`
    );
  } catch (error) {
    console.error(
      `❌ Fehler beim Firestore-Schreibvorgang für ${uid}:`,
      error.message
    );
  }
}

// --- 5. ÜBRIGE API ENDPUNKTE ---
app.use(express.json());

app.post("/create-checkout-session", async (req, res) => {
  try {
    const { uid, email, priceId } = req.body;
    if (!uid || !priceId)
      return res.status(400).json({ error: "Missing data" });

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer_email: email,
      client_reference_id: uid,
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: { metadata: { uid } },
      success_url: `https://schriftbot.com/success`,
      cancel_url: `https://schriftbot.com/`,
    });
    res.json({ url: session.url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/delete-user-data", async (req, res) => {
  const { uid } = req.body;
  try {
    if (!db) throw new Error("DB nicht bereit");
    const userRef = db.collection("users").doc(uid);
    const userDoc = await userRef.get();

    if (userDoc.exists) {
      const userData = userDoc.data();
      if (userData.stripeCustomerId) {
        await stripe.customers.del(userData.stripeCustomerId);
      }
      await userRef.delete();
      console.log(`✅ User ${uid} gelöscht.`);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/", (req, res) => res.json({ status: "active", engine: "deno" }));

const PORT = Deno.env.get("PORT") || 8000;
app.listen(PORT, () => console.log(`🚀 Server läuft auf Port ${PORT}`));
