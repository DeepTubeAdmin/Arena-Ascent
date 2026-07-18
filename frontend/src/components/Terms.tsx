// Terms of Service — static presentational page. Reuses the FAQ styling.
// NOTE FOR OPERATOR: This is a working template, not legal advice. Have a
// licensed attorney review and finalize before accepting real-money entries.
export default function Terms() {
  return (
    <main className="faq">
      <div className="eyebrow">TERMS OF SERVICE</div>
      <h1 className="page-title">Arena Ascent — Terms of Service</h1>
      <p className="faq-disclaimer" style={{ borderTop: "none", paddingTop: 0 }}>
        Last updated: July 2026
      </p>

      <section className="faq-section">
        <h2>1. Acceptance of these Terms</h2>
        <p>
          By accessing or using Arena Ascent (the "Service"), connecting a wallet,
          registering for a round, or playing a game, you agree to be bound by
          these Terms of Service. If you do not agree, do not use the Service.
        </p>
      </section>

      <section className="faq-section">
        <h2>2. Test period notice</h2>
        <p>
          The Service currently operates on the Arbitrum Sepolia <b>test
          network</b> using tokens that have <b>no monetary value</b>. Entries,
          prize pools, and payouts during this period involve test assets only.
          These Terms are written to also govern future operation with real
          digital assets; where a provision references fees or prizes of value,
          it applies from the date real-asset rounds commence.
        </p>
      </section>

      <section className="faq-section">
        <h2>3. Eligibility</h2>
        <p>
          You must be at least <b>18 years of age</b> (or the age of majority in
          your jurisdiction, whichever is greater) to use the Service. By using
          the Service you represent and warrant that you meet this requirement.
        </p>
        <p>
          <b>You are solely responsible for determining whether your use of the
          Service is lawful where you live.</b> Laws governing skill contests,
          paid-entry competitions, and digital assets vary by country, state,
          and locality. Before entering any round, you must confirm that
          participation does not violate any law, regulation, or rule that
          applies to you. If participation is unlawful where you are located,
          you are not permitted to use the Service, and any entry you make is
          void.
        </p>
        <p>
          You may not use the Service if you are located in, or a resident of,
          any jurisdiction where such use is prohibited, or if you are subject
          to sanctions or listed on any government prohibited-parties list.
        </p>
      </section>

      <section className="faq-section">
        <h2>4. Nature of the competition: skill, not chance</h2>
        <p>
          Arena Ascent hosts periodic competitions of skill. Outcomes are
          determined by measurable player performance — reaction time, accuracy,
          and decision-making — in a video game environment, and not by any
          wagering on uncertain events.
        </p>
        <p>
          It is the operator's position that these competitions are contests of
          skill: every entrant plays the same game under the same rules within
          the same time window; scoring is computed deterministically from the
          player's own recorded inputs; no outcome depends on the performance of
          a randomly drawn number, card, or event after entry; and prizes are
          awarded solely to the highest verified score. Entry fees fund a prize
          pool announced in advance, with a disclosed hosting fee.
        </p>
        <p>
          Notwithstanding the foregoing, the legal classification of paid-entry
          skill contests varies by jurisdiction, and nothing in these Terms is a
          representation that participation is lawful in your jurisdiction. See
          Section 3.
        </p>
      </section>

      <section className="faq-section">
        <h2>5. Rounds, entries, and one-attempt rule</h2>
        <p>
          Each round permits one entry per wallet address and exactly one play
          attempt. Entry fees are paid on-chain and are non-refundable once a
          round settles, except as provided in Section 7 (voided rounds).
          Round parameters — entry fee, schedule, prize split — are displayed
          before entry and may differ between rounds.
        </p>
      </section>

      <section className="faq-section">
        <h2>6. Fair play, scoring, and disqualification</h2>
        <p>
          Scores are computed server-side from your recorded inputs; any score
          displayed in your browser during play is provisional. Winning runs are
          subject to review, including deterministic replay analysis, before any
          settlement.
        </p>
        <p>
          <b>Automation, botting, input scripting, exploiting defects,
          collusion, or any manipulation of the game, client, or network is
          prohibited.</b> The operator may, in its sole discretion, disqualify
          any entry, withhold any prize from, and/or ban any participant found
          or reasonably suspected to have violated these rules. Disqualified
          entries forfeit any claim to prizes. Cheaters will not be paid.
        </p>
      </section>

      <section className="faq-section">
        <h2>7. Voided rounds and refunds</h2>
        <p>
          If a round cannot be completed or settled fairly — including due to
          technical failure, integrity concerns, or any other reason in the
          operator's discretion — the operator may void the round. When a round
          is voided, each entrant may reclaim their full entry fee on-chain, and
          no hosting fee is retained. Reclaiming a refund is an on-chain action
          each entrant performs from their own wallet; the operator does not
          custody or push refunds.
        </p>
      </section>

      <section className="faq-section">
        <h2>8. Wallets, keys, and blockchain risks</h2>
        <p>
          You interact with the Service using a self-custody wallet. <b>You are
          solely responsible for your wallet, private keys, and recovery
          phrase.</b> The operator never has access to your keys and cannot
          reverse blockchain transactions, recover lost keys, or retrieve funds
          sent to wrong addresses or wrong networks.
        </p>
        <p>
          You acknowledge the inherent risks of blockchain systems, including
          network congestion, transaction failure, gas fees, smart-contract
          defects, wallet software defects, and the volatility of digital
          assets. You accept these risks by using the Service.
        </p>
      </section>

      <section className="faq-section">
        <h2>9. Taxes</h2>
        <p>
          You are solely responsible for determining and paying any taxes that
          apply to prizes you receive or transactions you make through the
          Service.
        </p>
      </section>

      <section className="faq-section">
        <h2>10. No warranties</h2>
        <p>
          THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE," WITHOUT WARRANTY
          OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING WITHOUT LIMITATION
          WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE,
          NON-INFRINGEMENT, OR UNINTERRUPTED OR ERROR-FREE OPERATION.
        </p>
      </section>

      <section className="faq-section">
        <h2>11. Limitation of liability</h2>
        <p>
          TO THE MAXIMUM EXTENT PERMITTED BY LAW, THE OPERATOR AND ITS
          AFFILIATES, OFFICERS, EMPLOYEES, AND AGENTS SHALL NOT BE LIABLE FOR
          ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, EXEMPLARY, OR
          PUNITIVE DAMAGES, OR FOR ANY LOSS OF PROFITS, DATA, GOODWILL, OR
          DIGITAL ASSETS, ARISING FROM OR RELATING TO YOUR USE OF THE SERVICE.
          IN NO EVENT SHALL THE OPERATOR'S AGGREGATE LIABILITY EXCEED THE
          GREATER OF (A) THE ENTRY FEES YOU PAID IN THE ROUND GIVING RISE TO
          THE CLAIM, OR (B) ONE HUNDRED U.S. DOLLARS (US$100).
        </p>
      </section>

      <section className="faq-section">
        <h2>12. Indemnification</h2>
        <p>
          You agree to indemnify, defend, and hold harmless the operator and its
          affiliates from and against any claims, liabilities, damages, losses,
          and expenses (including reasonable attorneys' fees) arising out of or
          related to your use of the Service, your violation of these Terms, or
          your violation of any law or the rights of any third party.
        </p>
      </section>

      <section className="faq-section">
        <h2>13. Changes, suspension, and termination</h2>
        <p>
          The operator may modify these Terms, and may modify, suspend, or
          discontinue the Service or any round, at any time. Material changes
          will be reflected by an updated "Last updated" date. Continued use
          after changes constitutes acceptance. The operator may restrict or
          terminate access for any violation of these Terms.
        </p>
      </section>

      <section className="faq-section">
        <h2>14. Governing law and disputes</h2>
        <p>
          These Terms are governed by the laws of [YOUR STATE/JURISDICTION],
          without regard to conflict-of-law principles. Any dispute arising from
          these Terms or the Service shall be resolved in the courts located in
          [YOUR VENUE], and you consent to their exclusive jurisdiction.
          [CONSIDER: arbitration clause and class-action waiver — discuss with
          your attorney.]
        </p>
      </section>

      <section className="faq-section">
        <h2>15. Contact</h2>
        <p>Questions about these Terms: [CONTACT EMAIL].</p>
      </section>

      <p className="faq-disclaimer">
        These Terms include placeholders and must be reviewed and finalized by a
        licensed attorney before the Service accepts entries of real monetary
        value.
      </p>
    </main>
  );
}
