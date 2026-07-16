// FAQ / How it works — static presentational page. No backend calls.
export default function FAQ() {
  return (
    <main className="faq">
      <div className="eyebrow">HOW IT WORKS</div>
      <h1 className="page-title">Everything you need to know</h1>

      <section className="faq-section">
        <h2>What is Arena Ascent?</h2>
        <p>
          A monthly skill tournament. Once a month, a brand-new mini-game — one
          nobody has ever seen or practiced — goes live for a single short window.
          You get exactly <b>one attempt</b>. The highest score takes the prize pool.
        </p>
        <p>
          Every game appears once and is never used again. Next month is a
          different game, and everyone starts from zero again.
        </p>
        <p>
          It's a <b>solo</b> skill challenge, not head-to-head. You're not
          matched against another player in real time — everyone plays the same
          game under the same rules, and the best run wins.
        </p>
      </section>

      <section className="faq-section">
        <h2>How does a round work?</h2>
        <p>
          <b>1. Register.</b> During the registration window, pay the entry fee
          from your wallet. Every entry goes into the prize pool. The economics
          are shown before you enter: the fee, the current pool, and the split.
        </p>
        <p>
          <b>2. Show up.</b> When the live window opens, entrants can play. You
          have one attempt — once you press play, that's your run.
        </p>
        <p>
          <b>3. Win.</b> After the window closes, scores are verified and the
          winner is settled on-chain. The champion claims the prize directly to
          their wallet.
        </p>
      </section>

      <section className="faq-section">
        <h2>How are winners determined?</h2>
        <p>
          Scoring is <b>server-authoritative</b>: while you play, the site
          records your inputs, and our server independently re-computes your
          score from that record. The number you see during the game is
          provisional — the server's number is the one that counts. This means a
          modified game page can't fake a score.
        </p>
        <p>
          Before any payout, the winning run is <b>reviewed by a human</b> using
          a deterministic replay — an exact reconstruction of the run, input by
          input. Only after that review is the winner submitted on-chain.
        </p>
      </section>

      <section className="faq-section">
        <h2>Cheaters will not be paid</h2>
        <p>
          Runs showing signs of automation, botting, or manipulation are
          disqualified during the review. Every winning run is replayed and
          examined before settlement — inhuman timing patterns and
          script-like precision are exactly what the review looks for.
        </p>
        <p>
          If a round can't be settled fairly for any reason, it is voided and
          <b> every entrant is refunded in full</b>.
        </p>
      </section>

      <section className="faq-section">
        <h2>What does the winner get?</h2>
        <p>
          The winner receives <b>85% of the prize pool</b>, claimed directly to
          their wallet. Arena Ascent retains a 15% hosting fee for running the
          tournament. This split is displayed before you enter — no surprises.
        </p>
      </section>

      <section className="faq-section">
        <h2>Refunds and voided rounds</h2>
        <p>
          If a round is voided — a technical failure, unfair conditions,
          anything that prevents a fair result — every entrant reclaims their
          <b> full entry fee</b> from this site. No hosting fee is taken on a
          voided round.
        </p>
      </section>

      <section className="faq-section">
        <h2>What do I need to play?</h2>
        <p>
          A crypto wallet (we recommend <b>MetaMask</b>, a free browser
          extension) with a small amount of ETH or USDC on the <b>Arbitrum</b>
          network.
        </p>
        <p>
          MetaMask is a self-custody wallet: you hold your own funds, and your
          wallet address is your identity here — no username, no password.
          Signing in just means signing a message to prove the wallet is yours;
          it costs nothing.
        </p>
        <p>
          <b>Keep your recovery phrase private.</b> Arena Ascent will never ask
          for it. Nobody legitimate ever will.
        </p>
      </section>

      <section className="faq-section">
        <h2>How do I get ETH or USDC on Arbitrum?</h2>
        <p>
          Entries are paid in ETH or USDC on Arbitrum, a fast, low-fee network
          built on Ethereum. You'll also want a small amount of ETH on Arbitrum
          for network fees (typically fractions of a cent per transaction).
        </p>
        <p>
          Two common paths, worth researching for yourself:
        </p>
        <p>
          <b>Buy and withdraw.</b> Purchase ETH or USDC on a crypto exchange,
          then withdraw it to your wallet address — making sure to select the
          <b> Arbitrum (Arbitrum One)</b> network for the withdrawal.
        </p>
        <p>
          <b>Bridge.</b> If you already hold funds on Ethereum or another
          network, a bridge can move them to Arbitrum.
        </p>
        <p className="faq-warning">
          Double-check the network every time. Funds sent on the wrong network
          can be slow or costly to recover. The name to look for is
          <b> Arbitrum</b> (also called Arbitrum One).
        </p>
      </section>

      <section className="faq-section">
        <h2>Costs and honest expectations</h2>
        <p>
          Entering costs the entry fee plus a tiny network fee. One player wins
          each round; entering does not guarantee winning anything. This is a
          contest of skill — play because the challenge is fun, and play
          responsibly.
        </p>
      </section>

      <p className="faq-disclaimer">
        Round details — entry fees, windows, and rules — can change between
        rounds. Check the current round's terms before entering.
      </p>
    </main>
  );
}
