export default function ConsentInformation() {
  return (
    <details className="mb-6 rounded-[var(--radius-md)] border border-[var(--color-study-nested-border)] bg-[var(--color-study-nested)]">
      <summary className="flex cursor-pointer items-center justify-between px-4 py-3 text-sm font-medium text-[var(--color-study-text)] select-none">
        <span>Datenschutz- und Studieninformation</span>
        <span className="text-[var(--color-brand-700)] text-xs ml-4">▼ Vollständige Information lesen</span>
      </summary>

      <div className="space-y-4 px-4 pb-4 pt-2 text-sm text-[var(--color-study-text-muted)]">
        <section>
          <h4 className="mb-1 font-semibold text-[var(--color-study-text)]">1. Zweck der Studie</h4>
          <p>
            Diese Studie untersucht den Einfluss externer Medieninformationen auf Entscheidungsqualität
            und kognitive Belastung in simulierten Cyber-Krisen-Szenarien (Ransomware-Angriff auf
            kommunale Infrastruktur). Die Studie ist Teil der Masterarbeit
            "Desinformation und Entscheidungsqualität in Cyber-Krisen" an der IU Internationalen Hochschule.
          </p>
        </section>

        <section>
          <h4 className="mb-1 font-semibold text-[var(--color-study-text)]">2. Ablauf</h4>
          <p>
            Die Teilnahme umfasst: (1) Einwilligungserklärung, (2) demografische Angaben,
            (3) Briefing, (4) Simulation, (5) Fragebogen,
            (6) Debriefing. Geschätzte Gesamtdauer: 15–25 Minuten.
          </p>
          <p className="mt-1">
            <strong className="text-[var(--color-study-text)]">Wichtiger Hinweis:</strong> Teile des Szenarios können bewusst irreführend gestaltet
            sein. Im Debriefing am Ende der Studie wird dies vollständig aufgeklärt.
          </p>
        </section>

        <section>
          <h4 className="mb-1 font-semibold text-[var(--color-study-text)]">3. Erhobene Daten</h4>
          <ul className="ml-4 list-disc space-y-0.5">
            <li>Pseudonymisierte Teilnehmer-ID (kein Klarname, keine E-Mail)</li>
            <li>Demografische Angaben (Alter, Geschlecht, Berufserfahrung)</li>
            <li>Entscheidungsverhalten im Szenario (Zeitpunkte, Optionen)</li>
            <li>Interaktionsdaten (Verweildauer bei Informationen)</li>
            <li>Fragebogen-Antworten</li>
            <li>Technische Kontextdaten (Bildschirmauflösung, Browser)</li>
          </ul>
          <p className="mt-1">Es werden keine Klarnamen, E-Mail-Adressen oder IP-Adressen gespeichert.</p>
        </section>

        <section>
          <h4 className="mb-1 font-semibold text-[var(--color-study-text)]">4. Speicherdauer und Empfänger</h4>
          <p>
            Die pseudonymisierten Rohdaten werden höchstens für 10 Jahre gespeichert. Empfänger der Rohdaten sind ausschließlich
            der Forschende und der Betreuer. Keine Weitergabe an Dritte.
          </p>
        </section>

        <section>
          <h4 className="mb-1 font-semibold text-[var(--color-study-text)]">5. Ihre Rechte (DSGVO Art. 15–22)</h4>
          <ul className="ml-4 list-disc space-y-0.5">
            <li><strong className="text-[var(--color-study-text)]">Auskunft:</strong> Sie können jederzeit Auskunft über Ihre gespeicherten Daten erhalten.</li>
            <li><strong className="text-[var(--color-study-text)]">Berichtigung:</strong> Unrichtige Daten werden auf Anfrage korrigiert.</li>
            <li><strong className="text-[var(--color-study-text)]">Löschung:</strong> Ihre Daten werden auf Widerruf binnen 30 Tagen gelöscht (Art. 17).</li>
            <li><strong className="text-[var(--color-study-text)]">Widerruf:</strong> Sie können jederzeit ohne Angabe von Gründen die Teilnahme beenden.
              Bereits erhobene Daten werden auf Wunsch gelöscht. Hierzu verwenden Sie die
              "Teilnahme beenden"-Schaltfläche oder kontaktieren Sie den Forschenden.</li>
            <li><strong className="text-[var(--color-study-text)]">Beschwerde:</strong> Sie haben das Recht, sich bei der zuständigen Datenschutzbehörde zu beschweren.</li>
          </ul>
        </section>

        <section>
          <h4 className="mb-1 font-semibold text-[var(--color-study-text)]">6. Rechtliche Grundlage</h4>
          <p>
            Die Verarbeitung erfolgt auf Basis Ihrer Einwilligung gemäß DSGVO Art. 6 Abs. 1 lit. a
            und Art. 7. Die Einwilligung ist freiwillig und kann jederzeit widerrufen werden.
          </p>
        </section>

        <section>
          <h4 className="mb-1 font-semibold text-[var(--color-study-text)]">7. Kontakt</h4>
          <table className="w-full text-xs">
            <tbody>
              <tr>
                <td className="py-0.5 pr-4 font-semibold text-[var(--color-study-text)] align-top">Forschungsleitung:</td>
                <td>Kevin Maurer, IU Internationale Hochschule</td>
              </tr>
              <tr>
                <td className="py-0.5 pr-4 font-semibold text-[var(--color-study-text)] align-top">Betreuer:</td>
                <td>Prof. Dr.-Ing. Jörn-Marc Schmidt, IU Internationale Hochschule</td>
              </tr>
              <tr>
                <td className="py-0.5 pr-4 font-semibold text-[var(--color-study-text)] align-top">Kontakt:</td>
                <td>kevin.maurer@iu-study.org</td>
              </tr>
              <tr>
                <td className="py-0.5 pr-4 font-semibold text-[var(--color-study-text)] align-top">Widerruf / Löschanfragen (Art. 17 DSGVO):</td>
                <td>Bitte senden Sie eine E-Mail mit Ihrer Teilnahme-ID an die oben genannte Adresse.</td>
              </tr>
            </tbody>
          </table>
        </section>
      </div>
    </details>
  );
}
