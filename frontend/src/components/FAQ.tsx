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
          their wallet.
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
        <h2>You need a desktop or laptop computer</h2>
        <p>
          <b>Games must be played on a desktop or laptop.</b> Each month's game
          is a precision skill challenge — reaction time, accurate clicking,
          split-second decisions — and it will not function correctly on a phone
          or tablet. You can browse this site, register, and check results from
          any device, but when the play window opens, be at a computer with a
          mouse or trackpad. Attempts are not refunded for playing on an
          unsupported device.
        </p>
      </section>

      <section className="faq-section">
        <h2>What do I need to play?</h2>
        <p>
          A desktop computer, and a crypto wallet (we recommend <b>MetaMask</b>,
          a free browser extension) with a small amount of ETH on the
          <b> Arbitrum</b> network.
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
        <h2>Getting ETH on Arbitrum — read this carefully</h2>
        <p>
          Entry fees are paid in <b>ETH on the Arbitrum network</b> (also called
          Arbitrum One). This trips up even experienced crypto users, so let's
          be very clear:
        </p>
        <p>
          <b>ETH on Ethereum mainnet (L1) will NOT work here.</b> Think of
          Ethereum and Arbitrum as two parallel highways: your wallet address is
          the same on both, but your money sits on one highway at a time. If
          your ETH is on the Ethereum mainnet lane, this site can't use it —
          it must be on the Arbitrum lane. Same address, different network,
          different balance.
        </p>
        <p>
          To check which lane your ETH is on: open MetaMask, click the network
          selector (top-left), and switch between "Ethereum Mainnet" and
          "Arbitrum One" — you'll see your balance on each. You need a balance
          showing while <b>Arbitrum One</b> is selected.
        </p>
        <p>
          Here are the three ways to get ETH onto Arbitrum, from simplest to
          most technical. (Exact screens vary by app version and region — the
          key in every path is the same: <b>make sure the network says
          Arbitrum</b> before you confirm anything.)
        </p>
        <p>
          <b>Option A — Buy directly inside MetaMask (simplest).</b> MetaMask
          has a built-in Buy feature that can deliver ETH straight onto
          Arbitrum. Open MetaMask → switch the network selector to
          <b> Arbitrum One</b> → click <b>Buy</b> → choose ETH and confirm the
          network shown is Arbitrum → pick a payment provider and pay by card
          or bank transfer. The ETH arrives in your wallet already on Arbitrum
          — no bridging needed. Availability and fees vary by region and
          provider; double-check the network on the purchase screen before
          paying.
        </p>
        <p>
          <b>Option B — Buy on a crypto exchange, withdraw on the Arbitrum
          network.</b> Buy ETH on your exchange of choice (most major exchanges
          support this). Then withdraw it to your wallet — and here is the
          critical step: on the withdrawal screen, the exchange will ask you to
          <b> choose a network</b>. Select <b>Arbitrum One</b> (sometimes listed
          as just "Arbitrum" or "ARB1") — NOT "Ethereum" / "ERC-20". Paste your
          wallet address, and the ETH arrives on Arbitrum directly, usually
          within minutes and with a small withdrawal fee. If your exchange
          doesn't offer Arbitrum withdrawals, withdraw to Ethereum mainnet and
          use Option C. Tip: for your first withdrawal, send a small test
          amount, confirm it appears in MetaMask on Arbitrum One, then send the
          rest.
        </p>
        <p>
          <b>Option C — Bridge ETH you already have on Ethereum mainnet.</b> If
          your ETH is already sitting on Ethereum L1, a "bridge" moves it across
          to Arbitrum. The official route is the <b>Arbitrum Bridge</b> at
          bridge.arbitrum.io: connect your wallet, choose Ethereum → Arbitrum
          One, enter the amount of ETH, and confirm. You'll pay an Ethereum
          mainnet gas fee for the bridging transaction (this is the expensive
          part — often several dollars, depending on network traffic), and the
          ETH typically arrives on Arbitrum within about 15 minutes. MetaMask
          also has a built-in Bridge feature that does the same job from inside
          the wallet.
        </p>
        <p className="faq-warning">
          Every time, before you confirm: verify the destination network says
          <b> Arbitrum One</b>. Funds sent on the wrong network aren't
          necessarily lost (your address is the same everywhere), but moving
          them to the right network afterwards costs extra fees and time. And
          keep a little extra ETH beyond the entry fee — transactions on
          Arbitrum cost a fraction of a cent each, but they aren't free.
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
