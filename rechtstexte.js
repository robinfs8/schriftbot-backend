// =============================================================================
// RECHTSTEXTE für die Bestätigungs-E-Mails.
//
// Die Vertragsbestätigung (§ 312f Abs. 2 BGB) muss AGB und Widerrufsbelehrung
// auf einem dauerhaften Datenträger enthalten — ein Link auf die Website
// genügt dafür nicht (EuGH C-49/11). Deshalb steht der AGB-Text hier noch
// einmal als reiner Text.
//
// ⚠ AGB_TEXT muss wortgleich mit src/AGB.jsx im Frontend bleiben. Der Test
//   src/AGB.test.js vergleicht beide und schlägt bei Abweichungen fehl.
//   ANBIETER entspricht src/anbieter.js.
// =============================================================================

const ANBIETER = {
  geschaeftsbezeichnung: "Robin Foss Software",
  inhaber: "Robin Foss",
  strasse: "Horremer Straße 7",
  ort: "41470 Neuss",
  land: "Deutschland",
  email: "schriftbot@gmail.com",
  website: "schriftbot.com",
};

const ANBIETER_EINZEILIG = `${ANBIETER.geschaeftsbezeichnung}, ${ANBIETER.inhaber}, ${ANBIETER.strasse}, ${ANBIETER.ort}`;

const AGB_TEXT = `§ 1 Geltungsbereich

(1) Diese Allgemeinen Geschäftsbedingungen (nachfolgend „AGB“) gelten für alle Verträge über die Nutzung des Online-Dienstes Schriftbot unter ${ANBIETER.website} zwischen ${ANBIETER.inhaber}, handelnd unter der Geschäftsbezeichnung ${ANBIETER.geschaeftsbezeichnung}, ${ANBIETER.strasse}, ${ANBIETER.ort} (nachfolgend „Anbieter“), und dem Kunden.

(2) Verbraucher im Sinne dieser AGB ist jede natürliche Person, die ein Rechtsgeschäft zu Zwecken abschließt, die überwiegend weder ihrer gewerblichen noch ihrer selbständigen beruflichen Tätigkeit zugerechnet werden können (§ 13 BGB).

(3) Abweichende Bedingungen des Kunden werden nicht Vertragsbestandteil, es sei denn, der Anbieter stimmt ihrer Geltung ausdrücklich zu.

§ 2 Leistungen des Anbieters

(1) Schriftbot ist ein webbasierter Dienst, mit dem der Kunde Texte als handschriftähnliches Schriftbild darstellen und als PDF-, Bild- oder GoodNotes-Datei herunterladen kann.

(2) Editor und Vorschau können ohne Abonnement unentgeltlich genutzt werden. Für das Herunterladen von Dateien ist ein Kundenkonto erforderlich. Der Anbieter kann angemeldeten Kunden ohne Abonnement eine begrenzte Zahl unentgeltlicher Downloads gewähren, etwa als Startguthaben oder im Austausch gegen in den Spielen gesammelte Münzen. Ein Anspruch auf unentgeltliche Leistungen besteht nicht.

(3) Kostenpflichtige Leistungen werden als Monatsabonnement in verschiedenen Tarifen angeboten. Der Leistungsumfang des jeweiligen Tarifs ergibt sich aus der Tarifbeschreibung auf der Website und der Bestellübersicht zum Zeitpunkt der Bestellung.

(4) Ein Download berechtigt zum einmaligen Erzeugen und Herunterladen einer Datei. Das Kontingent eines Tarifs gilt jeweils für einen Abrechnungsmonat; nicht genutzte Downloads werden nicht in den Folgemonat übertragen. Downloads sind an das Kundenkonto gebunden, nicht übertragbar und nicht in Geld auszahlbar.

(5) In Tarifen, die eine eigene Handschrift umfassen, kann der Kunde die Zeichen seiner Handschrift im Browser zeichnen. Der Anbieter erzeugt daraus eine Schrift, die der Kunde für die Dauer des Abonnements nutzen kann. Die Zeichnung bleibt im Kundenkonto gespeichert, bis der Kunde das Konto löscht, und steht bei einem erneuten Abschluss wieder zur Verfügung.

(6) Der Anbieter stellt während der Vertragslaufzeit die Aktualisierungen bereit, die für den Erhalt der Vertragsmäßigkeit erforderlich sind (§ 327f BGB).

(7) Der Dienst steht grundsätzlich rund um die Uhr zur Verfügung. Vorübergehende Einschränkungen wegen Wartungsarbeiten, aus Sicherheitsgründen oder aufgrund von Störungen, die außerhalb des Einflussbereichs des Anbieters liegen, sind möglich. Die gesetzlichen Rechte des Kunden bleiben unberührt.

§ 3 Vertragsschluss

(1) Die Darstellung der Tarife auf der Website stellt kein rechtlich bindendes Angebot dar, sondern eine Aufforderung zur Abgabe einer Bestellung.

(2) Der Kunde wählt einen Tarif und meldet sich mit seinem Google-Konto an. In der Bestellübersicht werden ihm Tarif, Preis, Laufzeit und Kündigungsbedingungen angezeigt. Über die Schaltfläche „Weiter zur Zahlung“ gelangt er auf die Bezahlseite des Zahlungsdienstleisters Stripe und gibt dort seine Zahlungsdaten ein. Durch Anklicken der Schaltfläche „Kostenpflichtig abonnieren“ gibt der Kunde ein verbindliches Angebot zum Abschluss des Abonnements ab.

(3) Bis zum Anklicken dieser Schaltfläche kann der Kunde seine Eingaben jederzeit berichtigen: Die Bestellübersicht lässt sich schließen und der Tarif neu wählen; auf der Bezahlseite können alle Eingaben geändert werden, und über den Zurück-Link gelangt der Kunde ohne Bestellung zurück zu Schriftbot.

(4) Der Vertrag kommt zustande, indem der Anbieter das Angebot durch Freischaltung des gewählten Tarifs im Kundenkonto annimmt. Der Anbieter bestätigt den Vertragsschluss per E-Mail.

(5) Der Anbieter speichert den Vertragstext. Der Kunde erhält die Vertragsdaten, diese AGB und die Widerrufsbelehrung per E-Mail. Die jeweils aktuelle Fassung der AGB ist jederzeit unter ${ANBIETER.website}/agb abrufbar. Vertragssprache ist Deutsch.

(6) Minderjährige können einen kostenpflichtigen Vertrag nur mit Einwilligung ihrer gesetzlichen Vertreter schließen (§§ 107, 108 BGB).

§ 4 Kostenlose Testphase

(1) Für einzelne Tarife kann der Anbieter eine kostenlose Testphase anbieten. Dauer und Leistungsumfang ergeben sich aus der Bestellübersicht. Für die Testphase ist die Angabe einer Zahlungsart erforderlich; eine Belastung erfolgt erst nach ihrem Ende. Jedes Kundenkonto kann die Testphase nur einmal nutzen.

(2) Kündigt der Kunde während der Testphase, endet der Vertrag mit Zugang der Kündigung. Ab diesem Zeitpunkt entfällt der Zugriff auf die kostenpflichtigen Funktionen; Kosten entstehen nicht.

(3) Kündigt der Kunde nicht, geht die Testphase mit ihrem Ablauf in ein kostenpflichtiges Monatsabonnement zu dem in der Bestellübersicht genannten Preis über. Die erste Zahlung wird am Tag nach dem Ende der Testphase fällig.

§ 5 Preise und Zahlung

(1) Es gelten die zum Zeitpunkt der Bestellung angegebenen Preise. Die Preise sind Endpreise. Als Kleinunternehmer im Sinne von § 19 UStG berechnet der Anbieter keine Umsatzsteuer und weist diese nicht aus.

(2) Das Entgelt ist monatlich im Voraus zu zahlen, erstmals mit Vertragsschluss beziehungsweise nach Ablauf der Testphase. Die Zahlungsabwicklung erfolgt über den Zahlungsdienstleister Stripe Payments Europe, Ltd., Dublin, Irland. Die verfügbaren Zahlungsarten werden auf der Bezahlseite angezeigt.

(3) Schlägt eine Zahlung fehl, kann der Anbieter den Zugang zu den kostenpflichtigen Funktionen bis zum Ausgleich des fälligen Betrags aussetzen.

§ 6 Laufzeit und Kündigung

(1) Das Abonnement hat eine Laufzeit von einem Monat und verlängert sich jeweils um einen weiteren Monat, wenn es nicht gekündigt wird.

(2) Der Kunde kann das Abonnement jederzeit ohne Angabe von Gründen kündigen. Die Kündigung wird zum Ende des laufenden Abrechnungsmonats wirksam; bis dahin bleibt der Zugang bestehen. Für die Testphase gilt § 4 Abs. 2.

(3) Die Kündigung kann über die Kündigungsschaltfläche unter ${ANBIETER.website}/kuendigen ohne Anmeldung (§ 312k BGB) oder in Textform, etwa per E-Mail an ${ANBIETER.email}, erklärt werden. Der Anbieter bestätigt den Eingang der Kündigung unverzüglich in Textform.

(4) Das Recht beider Parteien zur außerordentlichen Kündigung aus wichtigem Grund bleibt unberührt. Ein wichtiger Grund liegt für den Anbieter insbesondere bei einem schwerwiegenden Verstoß gegen § 9 vor.

(5) Löscht der Kunde sein Kundenkonto, endet ein laufendes Abonnement mit sofortiger Wirkung. Eine anteilige Erstattung für den bereits bezahlten Abrechnungsmonat erfolgt in diesem Fall nicht; gesetzliche Ansprüche des Kunden bleiben unberührt.

§ 7 Widerrufsrecht für Verbraucher

Verbrauchern steht ein Widerrufsrecht nach Maßgabe der folgenden Belehrung zu.

Widerrufsbelehrung

Widerrufsrecht

Sie haben das Recht, binnen vierzehn Tagen ohne Angabe von Gründen diesen Vertrag zu widerrufen.

Die Widerrufsfrist beträgt vierzehn Tage ab dem Tag des Vertragsschlusses.

Um Ihr Widerrufsrecht auszuüben, müssen Sie uns (${ANBIETER_EINZEILIG}, E-Mail: ${ANBIETER.email}) mittels einer eindeutigen Erklärung (z. B. ein mit der Post versandter Brief oder E-Mail) über Ihren Entschluss, diesen Vertrag zu widerrufen, informieren. Sie können dafür das beigefügte Muster-Widerrufsformular verwenden, das jedoch nicht vorgeschrieben ist. Sie können Ihr Widerrufsrecht auch online unter ${ANBIETER.website}/widerruf ausüben. Wenn Sie diese Online-Funktion nutzen, übermitteln wir Ihnen auf einem dauerhaften Datenträger (z. B. durch eine E-Mail) unverzüglich eine Eingangsbestätigung mit Informationen zum Inhalt der Widerrufserklärung sowie dem Datum und der Uhrzeit ihres Eingangs.

Zur Wahrung der Widerrufsfrist reicht es aus, dass Sie die Mitteilung über die Ausübung des Widerrufsrechts vor Ablauf der Widerrufsfrist absenden.

Folgen des Widerrufs

Wenn Sie diesen Vertrag widerrufen, haben wir Ihnen alle Zahlungen, die wir von Ihnen erhalten haben, einschließlich der Lieferkosten (mit Ausnahme der zusätzlichen Kosten, die sich daraus ergeben, dass Sie eine andere Art der Lieferung als die von uns angebotene, günstigste Standardlieferung gewählt haben), unverzüglich und spätestens binnen vierzehn Tagen ab dem Tag zurückzuzahlen, an dem die Mitteilung über Ihren Widerruf dieses Vertrags bei uns eingegangen ist. Für diese Rückzahlung verwenden wir dasselbe Zahlungsmittel, das Sie bei der ursprünglichen Transaktion eingesetzt haben, es sei denn, mit Ihnen wurde ausdrücklich etwas anderes vereinbart; in keinem Fall werden Ihnen wegen dieser Rückzahlung Entgelte berechnet.

Haben Sie verlangt, dass die Dienstleistungen während der Widerrufsfrist beginnen soll, so haben Sie uns einen angemessenen Betrag zu zahlen, der dem Anteil der bis zu dem Zeitpunkt, zu dem Sie uns von der Ausübung des Widerrufsrechts hinsichtlich dieses Vertrags unterrichten, bereits erbrachten Dienstleistungen im Vergleich zum Gesamtumfang der im Vertrag vorgesehenen Dienstleistungen entspricht.

Ende der Widerrufsbelehrung

Muster-Widerrufsformular

(Wenn Sie den Vertrag widerrufen wollen, dann füllen Sie bitte dieses Formular aus und senden Sie es zurück.)

– An ${ANBIETER_EINZEILIG}, E-Mail: ${ANBIETER.email}
– Hiermit widerrufe(n) ich/wir (*) den von mir/uns (*) abgeschlossenen Vertrag über den Kauf der folgenden Waren (*)/die Erbringung der folgenden Dienstleistung (*)
– Bestellt am (*)/erhalten am (*)
– Name des/der Verbraucher(s)
– Anschrift des/der Verbraucher(s)
– Unterschrift des/der Verbraucher(s) (nur bei Mitteilung auf Papier)
– Datum

(*) Unzutreffendes streichen.

§ 8 Gewährleistung

(1) Es gelten die gesetzlichen Vorschriften über Mängel digitaler Produkte (§§ 327d ff. BGB).

(2) Beanstandungen und Beschwerden kann der Kunde an ${ANBIETER.email} richten. Der Anbieter beantwortet sie in der Regel innerhalb von drei Werktagen.

§ 9 Pflichten des Kunden und zulässige Nutzung

(1) Schriftbot ist ein Gestaltungswerkzeug für Notizen, Briefe, Karten, Einladungen, Lernunterlagen, Vorlagen, Entwürfe und vergleichbare Zwecke. Die erzeugten Dateien sind digitale Grafiken.

(2) Dem Kunden ist insbesondere untersagt,
- die Handschrift oder Unterschrift einer anderen Person ohne deren Einwilligung nachzubilden,
- Dokumente herzustellen oder zu verändern, um über ihren Aussteller oder ihre Echtheit zu täuschen, etwa Unterschriften, Entschuldigungen, Atteste, Zeugnisse, Verträge oder Ausweise (§§ 267 ff. StGB),
- erzeugte Texte entgegen schulischen, hochschulischen oder beruflichen Vorgaben als eigene Handschrift einzureichen, wo eine eigenhändige Niederschrift verlangt wird,
- rechtswidrige Inhalte zu erzeugen oder zu verbreiten,
- den Dienst automatisiert abzufragen oder technische Beschränkungen, insbesondere Download-Kontingente, zu umgehen.

(3) Die Rechte an den eingegebenen Texten verbleiben beim Kunden. Die erzeugten Dateien darf der Kunde für eigene Zwecke verwenden, auch nach Ende des Vertrags. Für den Inhalt der Texte und die Art ihrer Verwendung ist allein der Kunde verantwortlich; ob eine Verwendung im Einzelfall zulässig ist, etwa nach schulischen Vorgaben, hat er selbst zu prüfen.

(4) Bei einem Verstoß kann der Anbieter den Zugang sperren und den Vertrag nach § 6 Abs. 4 kündigen. Hinweise auf rechtswidrige Inhalte nimmt der Anbieter unter ${ANBIETER.email} entgegen.

§ 10 Haftung

(1) Der Anbieter haftet unbeschränkt bei Vorsatz und grober Fahrlässigkeit, für Schäden aus der Verletzung des Lebens, des Körpers oder der Gesundheit, nach dem Produkthaftungsgesetz sowie im Umfang einer übernommenen Garantie.

(2) Bei leicht fahrlässiger Verletzung einer wesentlichen Vertragspflicht ist die Haftung auf den vertragstypischen, vorhersehbaren Schaden begrenzt. Wesentliche Vertragspflichten sind Pflichten, deren Erfüllung die ordnungsgemäße Durchführung des Vertrags überhaupt erst ermöglicht und auf deren Einhaltung der Kunde regelmäßig vertrauen darf.

(3) Im Übrigen ist die Haftung für leicht fahrlässig verursachte Schäden ausgeschlossen.

(4) Die vorstehenden Beschränkungen gelten auch zugunsten der Erfüllungsgehilfen des Anbieters. Die gesetzlichen Mängelrechte nach § 8 bleiben unberührt.

§ 11 Datenschutz

Informationen zur Verarbeitung personenbezogener Daten enthält die Datenschutzerklärung.

§ 12 Streitbeilegung

Der Anbieter ist nicht bereit und nicht verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen (§ 36 Abs. 1 Nr. 1 VSBG).

§ 13 Schlussbestimmungen

(1) Es gilt das Recht der Bundesrepublik Deutschland. Gegenüber Verbrauchern gilt diese Rechtswahl nur insoweit, als dadurch nicht der Schutz entzogen wird, der durch zwingende Bestimmungen des Rechts des Staates gewährt wird, in dem der Verbraucher seinen gewöhnlichen Aufenthalt hat.

(2) Sind einzelne Bestimmungen dieser AGB unwirksam, bleibt der Vertrag im Übrigen wirksam (§ 306 BGB).`;

// Wesentliche Eigenschaften je Tarif für die Vertragsbestätigung — wie die
// Tarifkarten in src/plans.js. Unbekannte (ältere) Preise fallen auf die
// Produktbeschreibung aus Stripe zurück.
const TARIF_LEISTUNGEN = {
  price_1TC4In49gql0qC52FFnrr831:
    "30 Downloads pro Abrechnungsmonat, alle Handschriften, ohne Wasserzeichen",
  price_1UCIXb49gql0qC52MBbmP1fx:
    "Unbegrenzte Downloads, alle Handschriften, ohne Wasserzeichen, Export als GoodNotes-Datei, eigene Handschrift",
};

const ZEITZONE = "Europe/Berlin";

const datumUhrzeit = (d) =>
  new Date(d).toLocaleString("de-DE", {
    timeZone: ZEITZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }) + " Uhr";

const datum = (d) =>
  new Date(d).toLocaleDateString("de-DE", {
    timeZone: ZEITZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

const euro = (cent) =>
  (cent / 100).toLocaleString("de-DE", {
    style: "currency",
    currency: "EUR",
  });

const anrede = (name) => (name ? `Hallo ${name},` : "Hallo,");

const FUSS = `${ANBIETER_EINZEILIG}
E-Mail: ${ANBIETER.email} · ${ANBIETER.website}`;

const zeilen = (paare) =>
  paare
    .filter(([, wert]) => wert)
    .map(([label, wert]) => `${label}: ${wert}`)
    .join("\n");

// § 312f Abs. 2 BGB — Vertragsbestätigung mit allen Pflichtinformationen.
function vertragsbestaetigung({
  name,
  tarif,
  priceId,
  produktBeschreibung,
  preisCent,
  vertragsschluss,
  testphaseBis,
}) {
  const leistungen =
    TARIF_LEISTUNGEN[priceId] || produktBeschreibung || `Schriftbot ${tarif}`;
  const preis = `${euro(preisCent)} pro Monat (Endpreis; gemäß § 19 UStG wird keine Umsatzsteuer berechnet)`;

  const testphase = testphaseBis
    ? `Kostenlos bis ${datumUhrzeit(testphaseBis)}. Kündigst du in der Testphase, endet der Vertrag sofort, und es entstehen keine Kosten. Kündigst du nicht, geht die Testphase in das kostenpflichtige Monatsabonnement über; die erste Zahlung wird danach fällig.`
    : null;

  return {
    betreff: `Bestätigung deines Vertrags: Schriftbot ${tarif}`,
    text: `${anrede(name)}

vielen Dank für deine Bestellung. Hiermit bestätigen wir den Abschluss des folgenden Vertrags.

${zeilen([
  ["Anbieter", `${ANBIETER_EINZEILIG}, E-Mail: ${ANBIETER.email}`],
  ["Vertrag", `Schriftbot ${tarif}, Monatsabonnement`],
  ["Leistungen", leistungen],
  ["Preis", preis],
  ["Testphase", testphase],
  ["Vertragsschluss", datumUhrzeit(vertragsschluss)],
  [
    "Laufzeit",
    "ein Monat; das Abonnement verlängert sich automatisch um jeweils einen Monat, bis du kündigst",
  ],
  [
    "Kündigung",
    `jederzeit zum Ende des laufenden Abrechnungsmonats, ohne Anmeldung unter ${ANBIETER.website}/kuendigen oder per E-Mail an ${ANBIETER.email}`,
  ],
  [
    "Widerruf",
    `Du hast ein gesetzliches Widerrufsrecht von 14 Tagen ab Vertragsschluss, siehe die Widerrufsbelehrung in § 7 der AGB unten. Widerrufen kannst du auch online unter ${ANBIETER.website}/widerruf.`,
  ],
  [
    "Gewährleistung",
    "Es gilt das gesetzliche Gewährleistungsrecht für digitale Dienstleistungen.",
  ],
])}

Nachfolgend erhältst du unsere Allgemeinen Geschäftsbedingungen einschließlich Widerrufsbelehrung und Muster-Widerrufsformular, die Bestandteil des Vertrags sind.

────────────────────────────────────────
ALLGEMEINE GESCHÄFTSBEDINGUNGEN
────────────────────────────────────────

${AGB_TEXT}

────────────────────────────────────────
${FUSS}
`,
  };
}

// § 312k Abs. 4 BGB — Inhalt, Datum und Uhrzeit des Zugangs, Vertragsende.
function kuendigungsbestaetigung({
  name,
  email,
  anmerkung,
  eingang,
  vertragsende,
  sofortBeendet,
  ungeklaert,
}) {
  let ende;
  if (ungeklaert) {
    ende =
      "Zu deinen Angaben konnten wir kein laufendes Abonnement automatisch zuordnen. Wir prüfen deine Kündigung und melden uns bei dir.";
  } else if (sofortBeendet) {
    ende = `Deine kostenlose Testphase und damit der Vertrag enden mit Eingang der Kündigung am ${datumUhrzeit(eingang)}. Es entstehen keine Kosten.`;
  } else {
    ende = vertragsende
      ? `Der Vertrag endet am ${datum(vertragsende)}. Bis dahin kannst du Schriftbot wie gewohnt nutzen; danach wird nichts mehr abgebucht.`
      : "Der Vertrag endet zum Ende des laufenden Abrechnungsmonats. Bis dahin kannst du Schriftbot wie gewohnt nutzen.";
  }

  return {
    betreff: "Bestätigung deiner Kündigung",
    text: `${anrede(name)}

wir bestätigen den Eingang deiner Kündigung.

${zeilen([
  ["Inhalt", "Kündigung des Schriftbot-Abonnements"],
  ["Name", name],
  ["E-Mail-Adresse", email],
  ["Anmerkung", anmerkung],
  ["Eingang", datumUhrzeit(eingang)],
])}

${ende}

────────────────────────────────────────
${FUSS}
`,
  };
}

// § 356a Abs. 4 BGB — Inhalt der Widerrufserklärung, Datum und Uhrzeit.
function widerrufsbestaetigung({
  referenz,
  name,
  email,
  vertrag,
  nachricht,
  eingang,
}) {
  return {
    betreff: "Eingangsbestätigung deines Widerrufs",
    text: `${anrede(name)}

wir bestätigen den Eingang deiner Widerrufserklärung.

${zeilen([
  ["Referenznummer", referenz],
  ["Eingang", datumUhrzeit(eingang)],
  ["Erklärung", "Hiermit widerrufe ich den von mir abgeschlossenen Vertrag."],
  ["Name", name],
  ["E-Mail-Adresse", email],
  ["Vertrag", vertrag],
  ["Nachricht", nachricht],
])}

Wir prüfen deinen Widerruf. Zahlungen erstatten wir unverzüglich, spätestens binnen vierzehn Tagen ab Eingang der Erklärung, über das Zahlungsmittel, mit dem du bezahlt hast.

────────────────────────────────────────
${FUSS}
`,
  };
}

module.exports = {
  ANBIETER,
  AGB_TEXT,
  vertragsbestaetigung,
  kuendigungsbestaetigung,
  widerrufsbestaetigung,
};
