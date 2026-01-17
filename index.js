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
      // Explizite Angabe der Project ID hilft Deno bei der Adressierung
      projectId: serviceAccount.project_id,
    });
    console.log(
      `✅ Firebase für Projekt ${serviceAccount.project_id} initialisiert`
    );
  }

  db = admin.firestore();
  // Diese Einstellung hilft gegen "Undefined"-Fehler in Firestore
  db.settings({ ignoreUndefinedProperties: true });
} catch (error) {
  console.error("❌ Kritischer Fehler bei Firebase-Init:", error.message);
}

// --- 2. STRIPE SETUP ---
const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY"));
const app = express();
app.use(cors());

// --- 3. STRIPE WEBHOOK ---
// ... (Importe wie gehabt)

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
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // WICHTIG: Wir fangen alle Fehler pro Event ab, damit ein Fehler nicht den ganzen Webhook killt
    try {
      if (event.type === "checkout.session.completed") {
        const session = event.data.object;
        const uid = session.client_reference_id;
        if (uid) {
          const sessionWithItems = await stripe.checkout.sessions.retrieve(
            session.id,
            { expand: ["line_items.data.price.product"] }
          );
          const product = sessionWithItems.line_items.data[0].price.product;

          await updateFirestoreUser(uid, {
            creditsToAdd: parseInt(product.metadata.credits || "0"),
            isUnlimited: product.metadata.isUnlimited === "true",
            planName: product.metadata.planName || product.name,
            subscriptionId: session.subscription,
            customerId: session.customer,
            invoiceId: session.invoice,
          });
        }
      }

      if (event.type === "invoice.paid") {
        const invoice = event.data.object;
        // DEINE LOGIK: Erst-Rechnung ignorieren
        if (invoice.billing_reason !== "subscription_create") {
          const subscription = await stripe.subscriptions.retrieve(
            invoice.subscription
          );
          const uid = subscription.metadata.uid;
          if (uid) {
            const product = await stripe.products.retrieve(
              invoice.lines.data[0].price.product
            );
            await updateFirestoreUser(uid, {
              creditsToAdd: parseInt(product.metadata.credits || "0"),
              isUnlimited: product.metadata.isUnlimited === "true",
              planName: product.metadata.planName || product.name,
              invoiceId: invoice.id,
            });
          }
        }
      }
    } catch (err) {
      console.error("❌ Fehler bei Event-Verarbeitung:", err.message);
    }

    res.json({ received: true });
  }
);

// --- 4. HILFSFUNKTION ---
async function updateFirestoreUser(uid, data) {
  if (!db) return;

  try {
    const userRef = db.collection("users").doc(uid);
    const doc = await userRef.get();

    if (
      doc.exists &&
      doc.data().payments?.some((p) => p.invoiceId === data.invoiceId)
    ) {
      console.log("⚠️ Dublette: Rechnung bereits verarbeitet.");
      return;
    }

    // Wir schreiben nun in Firestore
    await userRef.set(
      {
        credits: data.isUnlimited
          ? 999999
          : admin.firestore.FieldValue.increment(data.creditsToAdd),
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

    console.log(`✅ Firestore erfolgreich für ${uid} aktualisiert.`);
  } catch (error) {
    console.error(`❌ Fehler beim Schreiben in Firestore: ${error.message}`);
    throw error; // Wichtig für das Promise.all oben
  }
}

// --- 5. WEITERE ENDPUNKTE ---
app.use(express.json());

app.post("/create-checkout-session", async (req, res) => {
  try {
    const { uid, email, priceId } = req.body;
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
    const userRef = db.collection("users").doc(uid);
    const userDoc = await userRef.get();
    if (userDoc.exists) {
      const userData = userDoc.data();
      if (userData.stripeCustomerId)
        await stripe.customers.del(userData.stripeCustomerId);
      await userRef.delete();
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/", (req, res) => res.send("Deno Backend Active"));

const PORT = Deno.env.get("PORT") || 8000;
app.listen(PORT, () => console.log(`🚀 Server läuft auf Port ${PORT}`));
