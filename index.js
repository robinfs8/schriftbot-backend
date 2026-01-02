require("dotenv").config();
const express = require("express");
const cors = require("cors");
const Stripe = require("stripe");
const admin = require("firebase-admin");

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const app = express();

// 1. Firebase Admin Initialisierung
// Du musst die Datei 'serviceAccountKey.json' aus deinem Firebase Projekt herunterladen
const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT
  ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
  : require("./serviceAccountKey.json"); // Fallback für lokales Testen

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// 2. CORS aktivieren
app.use(cors());

// 3. WICHTIG: Webhook-Endpoint VOR express.json()
// Stripe braucht den rohen Body (Raw), um die Signatur zu prüfen.
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
      console.error(`Webhook Error: ${err.message}`);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Wenn die Zahlung erfolgreich war
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;

      const userId = session.client_reference_id;
      const creditAmount = parseInt(session.metadata.credits);

      console.log(
        `Zahlung erfolgreich! User: ${userId}, Credits: ${creditAmount}`
      );

      try {
        // Update in Firestore: Credits zum bestehenden Wert hinzufügen
        const userRef = db.collection("users").doc(userId);
        await userRef.set(
          { credits: admin.firestore.FieldValue.increment(creditAmount) },
          { merge: true }
        );
        console.log("Firestore erfolgreich aktualisiert.");
      } catch (error) {
        console.error("Fehler beim Firestore Update:", error);
      }
    }

    res.json({ received: true });
  }
);

// 4. Jetzt erst express.json() für alle anderen Endpoints laden
app.use(express.json());

app.get("/", (req, res) => {
  res.json({ status: "ok", service: "schriftbot-backend" });
});

// Endpoint zum Erstellen der Checkout Session
app.post("/create-checkout-session", async (req, res) => {
  try {
    const { uid, quantity } = req.body;

    // Preislogik (Beispielhaft für 10 oder 20 Credits)
    let unitAmount = 199; // 1,99€git add .

    const session = await stripe.checkout.sessions.create({
      // Wir lassen payment_method_types weg, damit Stripe deine
      // Dashboard-Einstellungen (Klarna, Giropay, etc.) nutzt.

      mode: "payment",
      client_reference_id: uid,
      // Wichtig: Wir nutzen die E-Mail des Nutzers, falls vorhanden,
      // damit das Feld bei Stripe schon ausgefüllt ist.
      customer_email: req.body.email || undefined,

      metadata: {
        credits: 10, // Die Anzahl der Credits für den Webhook
      },
      line_items: [
        {
          price_data: {
            currency: "eur",
            product_data: {
              name: `${quantity} Schriftbot Credits`,
              description: "Digitale Credits für Schriftbot.com",
            },
            unit_amount: unitAmount,
          },
          quantity: 1,
        },
      ],
      success_url: `https://schriftbot.com/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `https://schriftbot.com/cancel`,
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error("Stripe Session Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server läuft auf Port", PORT));
