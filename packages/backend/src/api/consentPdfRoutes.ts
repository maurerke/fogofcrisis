import { Router, Request, Response } from "express";
import PDFDocument from "pdfkit";

const router = Router();

// In-memory rate limit for this unauthenticated, server-side PDF-generating
// endpoint (DoS protection). Single-process deployment, so a Map is sufficient
// (cf. failedAttempts throttle in auth.ts).
const MAX_REQUESTS = 10;
const WINDOW_MS = 15 * 60 * 1000;

interface RateEntry {
  count: number;
  windowStart: number;
}

const requestCounts = new Map<string, RateEntry>();

function isRateLimited(ip: string): boolean {
  const entry = requestCounts.get(ip);
  const now = Date.now();
  if (!entry || now - entry.windowStart > WINDOW_MS) {
    requestCounts.set(ip, { count: 1, windowStart: now });
    return false;
  }
  entry.count++;
  return entry.count > MAX_REQUESTS;
}

// POST /api/consent/pdf — generiert PDF-Einverständniserklärung
router.post("/consent/pdf", (req: Request, res: Response) => {
  const ip = req.ip ?? req.socket.remoteAddress ?? "unknown";
  if (isRateLimited(ip)) {
    res.status(429).json({ error: "Too many requests" });
    return;
  }

  const { pseudonymId, sessionId } = req.body as { pseudonymId?: unknown; sessionId?: unknown };

  // Validate untrusted input before embedding it in the PDF / filename.
  // Same charset rules as the participant ID check in the join handler.
  if (pseudonymId !== undefined &&
      (typeof pseudonymId !== "string" || pseudonymId.length > 80 || !/^[a-zA-Z0-9_-]*$/.test(pseudonymId))) {
    res.status(400).json({ error: "Invalid pseudonymId" });
    return;
  }
  if (sessionId !== undefined &&
      (typeof sessionId !== "string" || sessionId.length > 64 || !/^[a-zA-Z0-9-]*$/.test(sessionId))) {
    res.status(400).json({ error: "Invalid sessionId" });
    return;
  }

  const displayId = pseudonymId || "(noch nicht generiert)";
  const generatedAt = new Date().toLocaleString("de-DE", { timeZone: "Europe/Berlin" });

  const doc = new PDFDocument({ size: "A4", margin: 60 });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="Einverstaendnis_${displayId.replace(/[^a-zA-Z0-9-]/g, "_")}.pdf"`
  );

  doc.pipe(res);

  // Header
  doc
    .fontSize(18)
    .font("Helvetica-Bold")
    .text("Einverständniserklärung zur Studienteilnahme", { align: "center" })
    .moveDown(0.5);

  doc
    .fontSize(10)
    .font("Helvetica")
    .text("Masterarbeit: Desinformation und Entscheidungsqualität in Cyber-Krisen", { align: "center" })
    .text("IU Internationale Hochschule, 2026", { align: "center" })
    .moveDown(1.5);

  // Pseudonym-ID
  doc
    .fontSize(11)
    .font("Helvetica-Bold")
    .text("Pseudonym-ID (bitte aufbewahren):")
    .font("Helvetica")
    .fontSize(13)
    .text(displayId, { continued: false })
    .moveDown(0.5)
    .fontSize(9)
    .text(
      "Diese ID benötigen Sie für Auskunfts- und Löschanfragen. Sie wurde aus einer " +
      "persönlichen Zeichenfolge berechnet und ist nicht umkehrbar."
    )
    .moveDown(1);

  // Datum
  doc
    .fontSize(10)
    .font("Helvetica")
    .text(`Erstellt: ${generatedAt}`)
    .moveDown(1.5);

  // Abschnitt: Zweck
  section(doc, "1. Zweck der Studie");
  doc
    .fontSize(10)
    .font("Helvetica")
    .text(
      "Diese Studie untersucht den Einfluss externer Medieninformationen auf Entscheidungsqualität " +
      "und kognitive Belastung in simulierten Cyber-Krisen-Szenarien (Ransomware-Angriff auf " +
      "kommunale Infrastruktur). Die Studie ist Teil der Masterarbeit " +
      "\"Desinformation und Entscheidungsqualität in Cyber-Krisen\" an der IU Internationalen Hochschule."
    )
    .moveDown(0.8);

  section(doc, "2. Ablauf");
  doc
    .fontSize(10)
    .font("Helvetica")
    .text(
      "Die Teilnahme umfasst: (1) Einwilligungserklärung, (2) demografische Angaben, " +
      "(3) Briefing, (4) Simulation, (5) Fragebogen, (6) Debriefing. " +
      "Geschätzte Gesamtdauer: 15–25 Minuten."
    )
    .moveDown(0.3)
    .text(
      "Wichtiger Hinweis: Teile des Szenarios können bewusst irreführend gestaltet sein. " +
      "Im Debriefing am Ende der Studie wird dies vollständig aufgeklärt."
    )
    .moveDown(0.8);

  section(doc, "3. Erhobene Daten");
  doc
    .fontSize(10)
    .font("Helvetica")
    .text("• Pseudonymisierte Teilnehmer-ID (kein Klarname, keine E-Mail)")
    .text("• Demografische Angaben (Alter, Geschlecht, Berufserfahrung)")
    .text("• Entscheidungsverhalten im Szenario (Zeitpunkte, Optionen)")
    .text("• Interaktionsdaten (Verweildauer bei Informationen)")
    .text("• Fragebogen-Antworten")
    .text("• Technische Kontextdaten (Bildschirmauflösung, Browser)")
    .moveDown(0.3)
    .text("Es werden keine Klarnamen, E-Mail-Adressen oder IP-Adressen gespeichert.")
    .moveDown(0.8);

  section(doc, "4. Speicherdauer und Empfänger");
  doc
    .fontSize(10)
    .font("Helvetica")
    .text(
      "Die pseudonymisierten Rohdaten werden höchstens für 10 Jahre gespeichert. " +
      "Empfänger der Rohdaten sind ausschließlich der Forschende und der Betreuer. " +
      "Keine Weitergabe an Dritte."
    )
    .moveDown(0.8);

  section(doc, "5. Ihre Rechte (DSGVO Art. 15–22)");
  doc
    .fontSize(10)
    .font("Helvetica")
    .text("• Auskunft: Sie können jederzeit Auskunft über Ihre gespeicherten Daten erhalten.")
    .text("• Berichtigung: Unrichtige Daten werden auf Anfrage korrigiert.")
    .text("• Löschung: Ihre Daten werden auf Widerruf binnen 30 Tagen gelöscht (Art. 17).")
    .text(
      "• Widerruf: Sie können jederzeit ohne Angabe von Gründen die Teilnahme beenden. " +
      "Bereits erhobene Daten werden auf Wunsch gelöscht."
    )
    .text("• Beschwerde: Sie haben das Recht, sich bei der zuständigen Datenschutzbehörde zu beschweren.")
    .moveDown(0.8);

  section(doc, "6. Rechtliche Grundlage");
  doc
    .fontSize(10)
    .font("Helvetica")
    .text(
      "Die Verarbeitung erfolgt auf Basis Ihrer Einwilligung gemäß DSGVO Art. 6 Abs. 1 lit. a " +
      "und Art. 7. Die Einwilligung ist freiwillig und kann jederzeit widerrufen werden."
    )
    .moveDown(0.8);

  section(doc, "7. Kontakt");
  doc
    .fontSize(10)
    .font("Helvetica")
    .text("Forschungsleitung: Kevin Maurer, IU Internationale Hochschule")
    .text("Betreuer: Prof. Dr.-Ing. Jörn-Marc Schmidt, IU Internationale Hochschule")
    .text("Kontakt: kevin.maurer@iu-study.org")
    .text(
      "Widerruf / Löschanfragen (Art. 17 DSGVO): Bitte senden Sie eine E-Mail mit " +
      "Ihrer Teilnahme-ID an die oben genannte Adresse."
    )
    .moveDown(1.5);

  // Checkboxen
  section(doc, "Bestätigte Einwilligungen");
  const items = [
    "Ich habe die Datenschutz- und Studieninformation gelesen und verstanden.",
    "Ich nehme freiwillig teil und kann jederzeit ohne Angabe von Gründen abbrechen.",
    "Ich bin damit einverstanden, dass meine pseudonymisierten Daten erhoben und ausgewertet werden.",
    "Ich nehme zur Kenntnis, dass Teile des Szenarios bewusst irreführend gestaltet sein können und im Debriefing aufgeklärt werden.",
  ];
  items.forEach((item) => {
    doc.fontSize(10).font("Helvetica").text(`☑  ${item}`).moveDown(0.3);
  });

  doc.moveDown(1);
  doc
    .fontSize(9)
    .font("Helvetica")
    .text(
      "Dieses Dokument dient als Nachweis der informierten Einwilligung. " +
      "Es wurde automatisch durch das Studien-System generiert. " +
      `Session-Referenz: ${sessionId || "n/a"}`
    );

  doc.end();
});

function section(doc: InstanceType<typeof PDFDocument>, title: string): void {
  doc
    .fontSize(11)
    .font("Helvetica-Bold")
    .text(title)
    .moveDown(0.3)
    .font("Helvetica");
}

export default router;
