require("dotenv").config();
const express = require("express");
const cors = require("cors");
const Stripe = require("stripe");
const admin = require("firebase-admin");
const Groq = require("groq-sdk");

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const app = express();
const groqModel = process.env.GROQ_MODEL || "moonshotai/kimi-k2-instruct";
const groq = process.env.GROQ_API_KEY
  ? new Groq({ apiKey: process.env.GROQ_API_KEY })
  : null;

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
        const hasPREMIUM = product.metadata.hasPREMIUM === "true";
        const planName = product.metadata.planName || product.name;

        console.log(
          `🌟 ERSTKAUF: User ${uid} → ${creditsToAdd} Credits (${planName})`
        );

        await updateFirestoreUser(uid, {
          creditsToAdd,
          isUnlimited,
          hasPREMIUM,
          planName,
          subscriptionId: session.subscription,
          customerId: session.customer,
          invoiceId: session.invoice || `checkout_${session.id}`,
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

      if (invoice.billing_reason === "subscription_create")
        return res.json({ received: true });

      if (invoice.billing_reason === "subscription_cycle") {
        console.log(`🔄 Verlängerung erkannt für Invoice: ${invoice.id}`);

        try {
          // Subscription-ID aus neuer API-Struktur holen
          const subscriptionId =
            invoice.parent?.subscription_details?.subscription ||
            invoice.subscription ||
            null;

          // 1. VERSUCH: UID direkt aus invoice.parent.subscription_details.metadata
          let uid = invoice.parent?.subscription_details?.metadata?.uid || null;
          console.log(`🔍 UID aus Invoice-Metadata: ${uid}`);

          // 2. VERSUCH: UID aus Subscription-Metadaten via Stripe API
          if (!uid && subscriptionId) {
            const subscription = await stripe.subscriptions.retrieve(
              subscriptionId
            );
            uid = subscription.metadata.uid;
            console.log(`🔍 UID aus Subscription-Metadata: ${uid}`);
          }

          // 3. VERSUCH: Suche in Firestore nach stripeCustomerId
          if (!uid) {
            console.log(`🔍 Suche User mit Customer-ID: ${invoice.customer}`);
            const userSnapshot = await db
              .collection("users")
              .where("stripeCustomerId", "==", invoice.customer)
              .limit(1)
              .get();

            if (!userSnapshot.empty) {
              uid = userSnapshot.docs[0].id;
              console.log(`✅ User-UID über Customer-ID gefunden: ${uid}`);
            }
          }

          if (!uid) {
            console.error(
              `❌ Kritisch: Kein User für Customer ${invoice.customer} gefunden.`
            );
            return res.json({ received: true });
          }

          // Produkt-ID aus neuer API-Struktur holen
          const lineItem = invoice.lines.data[0];
          const productId =
            lineItem?.pricing?.price_details?.product ||
            lineItem?.price?.product ||
            lineItem?.plan?.product;

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

          await updateFirestoreUser(uid, {
            creditsToAdd,
            isUnlimited,
            planName,
            subscriptionId, // ← nicht mehr invoice.subscription
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
    // ABO AKTUALISIERT (z. B. Kündigung zum Laufzeitende gesetzt)
    // Hält den Firestore-Status synchron, damit die UI "Gekündigt – Zugang bis
    // TT.MM.JJJJ" korrekt anzeigen kann (§ 312k Nachvollziehbarkeit).
    // =============================================================================
    if (event.type === "customer.subscription.updated") {
      const subscription = event.data.object;
      const uid = subscription.metadata?.uid;

      if (uid) {
        try {
          await db
            .collection("users")
            .doc(uid)
            .set(
              {
                cancelAtPeriodEnd: subscription.cancel_at_period_end === true,
                subscriptionStatus: subscription.status,
                currentPeriodEnd: subscription.current_period_end
                  ? new Date(
                      subscription.current_period_end * 1000
                    ).toISOString()
                  : null,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
              },
              { merge: true }
            );
          console.log(
            `🔁 Abo-Status aktualisiert für ${uid}: cancel_at_period_end=${subscription.cancel_at_period_end}`
          );
        } catch (err) {
          console.error("❌ Firestore Error (subscription.updated):", err);
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
    data.invoiceId &&
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

  const updateData = {
    credits: newCredits,
    isUnlimited: data.isUnlimited,
    hasPREMIUM: true,
    lastPaymentStatus: "active",
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
  };

  // Plan & SubscriptionId nur bei Abos setzen, nicht bei Einmalkäufen
  if (data.subscriptionId) {
    updateData.plan = data.planName;
    updateData.subscriptionId = data.subscriptionId;
  } else if (data.planName === "400") {
    updateData.plan = data.planName;
  }

  await userRef.set(updateData, { merge: true });

  console.log(
    `✅ Firestore aktualisiert: User ${uid} hat jetzt ${newCredits} Credits`
  );
}

// =============================================================================
// JSON MIDDLEWARE
// =============================================================================
app.use(express.json());

// =============================================================================
// KI TEXT UMSCHREIBEN
// =============================================================================
app.post("/rewrite-text", async (req, res) => {
  try {
    if (!groq) {
      return res.status(500).json({
        error:
          "GROQ_API_KEY fehlt auf dem Server. Bitte im Backend als Umgebungsvariable setzen.",
      });
    }

    const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";
    if (!text) {
      return res.status(400).json({ error: "Text darf nicht leer sein." });
    }

    const completion = await groq.chat.completions.create({
      model: groqModel,
      temperature: 0.6,
      max_completion_tokens: 1024,
      messages: [
        {
          role: "system",
          content: `Du bist Schriftbot-AI, ein intelligenter Lernassistent. Deine Aufgabe ist es, präzise und hilfreiche Texte zu verfassen.
      
      WICHTIGE REGELN:
      - Erkenne die Sprache automatisch (Deutsch, Englisch, etc.) und antworte in derselben Sprache
      - Schreibe IMMER nur einen zusammenhängenden Text, keine Stichpunkte oder Aufzählungen, außer der Nutzer will es anders
      - Gliedere den Text mit Absätzen für bessere Lesbarkeit (nicht übertreiben)
      - Schreibe auf Niveau eines intelligenten 9.-Klässlers
      - Sei klar, prägnant und verständlich
      - Bei Erklärungen: Integriere Beispiele natürlich in den Textfluss
      - Bei Aufgaben: Zeige Lösungswege im Textformat
      - KEINE Meta-Kommentare, Überschriften oder Formatierungssymbole
      - Gib nur den reinen Text aus`,
        },
        {
          role: "user",
          content: text,
        },
      ],
    });

    const rewrittenText = completion.choices?.[0]?.message?.content?.trim();
    if (!rewrittenText) {
      return res
        .status(502)
        .json({ error: "Keine gültige Antwort von Groq erhalten." });
    }

    return res.json({ rewrittenText });
  } catch (error) {
    console.error("❌ Fehler bei /rewrite-text:", error);
    return res.status(500).json({ error: "Umschreiben fehlgeschlagen." });
  }
});

// =============================================================================
// CHECKOUT SESSION ERSTELLEN
// =============================================================================
app.post("/create-checkout-session", async (req, res) => {
  try {
    console.log("📥 Checkout Request:", req.body);
    const { uid, email, priceId, widerrufsverzicht } = req.body;

    // 1. Validierung
    if (!priceId || !uid || !email) {
      console.error("❌ Fehlende Daten:", { priceId, uid, email });
      return res.status(400).json({ error: "Fehlende Daten für den Checkout" });
    }

    // Ohne ausdrücklichen Widerrufsverzicht (§ 356 Abs. 5 BGB) kein Checkout
    if (widerrufsverzicht !== true) {
      return res.status(400).json({
        error: "Zustimmung zum Erlöschen des Widerrufsrechts erforderlich",
      });
    }

    // 2. Bestimmen, ob es ein Abo oder eine Einmalzahlung ist
    // Wir listen hier die IDs der Abos auf. Alles andere wird als "payment" (Einmal) behandelt.
    // index.js (in der Route /create-checkout-session)
    const subscriptionPriceIds = [
      "price_1SoLNO49gql0qC52Y0vVUK5W", // Basic Abo
      "price_1SqFid49gql0qC52OCgqnpsf", // Pass Abo
      "price_1SnmIw49gql0qC520ajSTJ5d", // Unlimited Abo
      "price_1TC4In49gql0qC52FFnrr831", // NEU: Freischalten / Beitreten Abo
      "price_1TNxWU49gql0qC52RENX2UFp", // Unlimited Abo Nr. 2
      "price_1TWfSw49gql0qC52RvoMi6b0", // Schriftbot Pass ABo (6,49) - ANker auf Schriftbot Unlimited
      "price_1TC3qW49gql0qC52CHtSeLWb", // Schriftbot Starter 2,99/moant
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
      // Metadata auf Session-Ebene (für beide Modi); Widerrufsverzicht
      // wird als Nachweis mit Zeitstempel in Stripe dokumentiert.
      metadata: {
        uid,
        widerrufsverzicht: "ja",
        widerrufsverzicht_datum: new Date().toISOString(),
      },
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

// =============================================================================
// HILFSFUNKTION: Aktive Stripe-Subscriptions eines Kunden ermitteln
// =============================================================================
async function findActiveSubscriptions(customerId) {
  const subs = await stripe.subscriptions.list({
    customer: customerId,
    status: "all",
    limit: 10,
  });
  return subs.data.filter((s) =>
    ["active", "trialing", "past_due", "unpaid"].includes(s.status)
  );
}

// =============================================================================
// HILFSFUNKTION: Optionales Firebase-ID-Token auslesen (uid oder null)
// =============================================================================
async function uidFromOptionalToken(req) {
  const authHeader = req.headers.authorization || "";
  const idToken = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : null;
  if (!idToken) return null;
  try {
    const decoded = await admin.auth().verifyIdToken(idToken);
    return decoded.uid;
  } catch (err) {
    return null;
  }
}

// =============================================================================
// KÜNDIGUNG (§ 312k BGB - Kündigungsbutton)
// Kündigt das Abo zum Ende des laufenden Abrechnungszeitraums (reversibel).
// Kein Login erforderlich: Identifikation wahlweise über eingeloggtes Token
// ODER über die E-Mail-Adresse des Stripe-Kunden. Wird als Nachweis in
// Firestore dokumentiert (Zeitstempel).
// =============================================================================
app.post("/cancel-subscription", async (req, res) => {
  try {
    const { email, name, note } = req.body || {};
    const uid = await uidFromOptionalToken(req);

    // 1. Stripe-Customer(s) ermitteln
    let customerIds = [];

    if (uid) {
      const userDoc = await db.collection("users").doc(uid).get();
      const cid = userDoc.exists ? userDoc.data().stripeCustomerId : null;
      if (cid) customerIds.push(cid);
    }

    if (customerIds.length === 0) {
      if (!email) {
        return res.status(400).json({
          error:
            "Bitte gib die E-Mail-Adresse an, mit der du dein Abo abgeschlossen hast.",
        });
      }
      const customers = await stripe.customers.list({ email, limit: 10 });
      customerIds = customers.data.map((c) => c.id);
    }

    if (customerIds.length === 0) {
      return res.status(404).json({
        error:
          "Zu diesen Angaben wurde kein Konto gefunden. Bitte prüfe die E-Mail-Adresse oder kontaktiere schriftbot@gmail.com.",
      });
    }

    // 2. Aktive Subscriptions zum Laufzeitende kündigen
    let canceledCount = 0;
    let endDate = null;

    for (const customerId of customerIds) {
      const subs = await findActiveSubscriptions(customerId);
      for (const sub of subs) {
        const updated = await stripe.subscriptions.update(sub.id, {
          cancel_at_period_end: true,
          metadata: {
            ...sub.metadata,
            canceled_via: uid ? "app_button" : "public_form",
            canceled_at: new Date().toISOString(),
          },
        });
        canceledCount += 1;
        if (updated.current_period_end) {
          endDate = new Date(updated.current_period_end * 1000).toISOString();
        }
      }
    }

    // 3. Nachweis dokumentieren (Eingangsbestätigung/Protokoll)
    const receivedAt = new Date().toISOString();
    await db.collection("cancellations").add({
      uid: uid || null,
      email: email || null,
      name: name || null,
      note: note || null,
      customerIds,
      canceledCount,
      endDate,
      receivedAt,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    if (uid) {
      await db.collection("users").doc(uid).set(
        {
          cancelRequestedAt: receivedAt,
          cancelAtPeriodEnd: true,
        },
        { merge: true }
      );
    }

    if (canceledCount === 0) {
      return res.status(404).json({
        error:
          "Es wurde kein aktives Abonnement gefunden. Möglicherweise ist es bereits gekündigt.",
      });
    }

    // Hinweis: Stripe versendet bei entsprechender Dashboard-Einstellung
    // automatisch eine Kündigungs-Bestätigung per E-Mail (dauerhafter
    // Datenträger i. S. d. § 312k Abs. 3 BGB). Zusätzlich zeigt das Frontend
    // eine speicher-/druckbare Bestätigung an.
    return res.json({ success: true, endDate, receivedAt, canceledCount });
  } catch (err) {
    console.error("❌ Fehler bei /cancel-subscription:", err);
    return res
      .status(500)
      .json({ error: "Kündigung fehlgeschlagen: " + err.message });
  }
});

// =============================================================================
// WIDERRUF (§ 356a BGB - Widerrufsbutton, Pflicht seit 19.06.2026)
// Nimmt die Widerrufserklärung entgegen, dokumentiert sie mit Zeitstempel und
// bestätigt den Eingang. Kein Login erforderlich.
// Bewusst KEIN automatischer Storno/Refund: Ob der Widerruf wirksam ist (z. B.
// trotz Verzicht bei sofortiger Ausführung, § 356 Abs. 5 BGB) und ob/wie viel
// zu erstatten ist (§ 357 BGB), ist eine rechtliche Einzelfallprüfung durch den
// Anbieter. Die Erstattung erfolgt fristgerecht nach Prüfung.
// =============================================================================
app.post("/withdraw-contract", async (req, res) => {
  try {
    const { email, name, orderInfo, message } = req.body || {};
    const uid = await uidFromOptionalToken(req);

    if (!email && !uid) {
      return res.status(400).json({
        error: "Bitte gib die E-Mail-Adresse deiner Bestellung an.",
      });
    }

    const receivedAt = new Date().toISOString();
    const ref = await db.collection("withdrawals").add({
      uid: uid || null,
      email: email || null,
      name: name || null,
      orderInfo: orderInfo || null,
      message: message || null,
      status: "eingegangen",
      receivedAt,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`📩 Widerruf eingegangen (${ref.id}) von ${email || uid}`);

    // Eingangsbestätigung: Referenznummer + Zeitpunkt (§ 356a Abs. 3 BGB).
    return res.json({
      success: true,
      reference: ref.id,
      receivedAt,
    });
  } catch (err) {
    console.error("❌ Fehler bei /withdraw-contract:", err);
    return res
      .status(500)
      .json({ error: "Widerruf konnte nicht übermittelt werden: " + err.message });
  }
});

// Endpunkt zum Vorbereiten der Löschung (Stripe & Firestore)
app.post("/delete-user-data", async (req, res) => {
  // Identität per Firebase-ID-Token prüfen: Nur der eingeloggte Nutzer
  // selbst darf seine Daten löschen (UID kommt aus dem Token, nie aus dem Body).
  const authHeader = req.headers.authorization || "";
  const idToken = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : null;

  if (!idToken) {
    return res.status(401).json({ error: "Nicht autorisiert" });
  }

  let uid;
  try {
    const decoded = await admin.auth().verifyIdToken(idToken);
    uid = decoded.uid;
  } catch (err) {
    console.error("Ungültiges ID-Token bei Löschanfrage:", err.message);
    return res.status(401).json({ error: "Nicht autorisiert" });
  }

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

    // 3. Gruppen bereinigen (DSGVO Art. 17): Mitgliedschaft, Anzeigename
    // und eigene Nachrichten entfernen; leere Gruppen komplett löschen.
    const groupsSnap = await db
      .collection("groups")
      .where("members", "array-contains", uid)
      .get();

    for (const groupDoc of groupsSnap.docs) {
      const batch = db.batch();
      const remaining = (groupDoc.data().members || []).filter(
        (m) => m !== uid
      );

      if (remaining.length === 0) {
        // Letztes Mitglied: ganze Gruppe inkl. aller Nachrichten löschen
        const allMsgs = await groupDoc.ref.collection("messages").get();
        allMsgs.docs.forEach((m) => batch.delete(m.ref));
        batch.delete(groupDoc.ref);
      } else {
        const ownMsgs = await groupDoc.ref
          .collection("messages")
          .where("authorUid", "==", uid)
          .get();
        ownMsgs.docs.forEach((m) => batch.delete(m.ref));
        batch.update(groupDoc.ref, {
          members: admin.firestore.FieldValue.arrayRemove(uid),
          [`memberNames.${uid}`]: admin.firestore.FieldValue.delete(),
        });
      }
      await batch.commit();
    }
    if (!groupsSnap.empty) {
      console.log(`Gruppen-Daten für ${uid} bereinigt.`);
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
