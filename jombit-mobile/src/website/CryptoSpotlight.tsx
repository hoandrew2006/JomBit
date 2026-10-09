import { useState } from "react";
import { ArrowDownUp, ArrowRight, Layers3, Wallet } from "lucide-react";
import { CryptoHoldingFacts } from "../../app/components/CryptoHoldingFacts";
import { createSeedState } from "../../lib/seed";
import { STAKING_ASSETS, CRYPTO_NAMES } from "../../lib/crypto-ledger";
import { LUNO_INTEGRATION_NOTE, LUNO_STAKING_GUIDE } from "../../lib/staking-config";
import { DEMO_CRYPTO_PRICES_MYR } from "../../lib/mock-services";
import type { CryptoAsset } from "../../lib/models";

const sampleHoldings = createSeedState().crypto;

export function PortfolioPreview() {
  const [asset, setAsset] = useState<CryptoAsset>("ETH");
  return <div className="m-portfolio-preview">
    <div className="m-coin-picker" role="group" aria-label="Choose a sample crypto holding">{STAKING_ASSETS.map((code) => <button type="button" key={code} aria-pressed={asset === code} onClick={() => setAsset(code)}>{code}</button>)}</div>
    <div className="m-position-title"><h3>{CRYPTO_NAMES[asset]}</h3><span>Sample holding</span></div>
    <div key={asset} className="m-position-facts"><CryptoHoldingFacts asset={asset} holding={sampleHoldings[asset]} referencePrice={DEMO_CRYPTO_PRICES_MYR[asset]} priceLabel="Reference price (demo)" /></div>
    <p className="m-price-note">Static sample prices, not a live market feed.</p>
  </div>;
}

export const cryptoFeatures = [
  { title: "Your staking balances, in view.", label: "Overview", icon: Wallet, description: "See unstaked and staked holdings together. Existing purchase dates and costs remain historical context, not an offer to buy or sell crypto in JomBit." },
  { title: "A planned Luno integration.", label: "Luno plan", icon: ArrowDownUp, description: "We plan to work with Luno on a staking-focused experience. Provider approval and technical access still need to be established. No partnership or account connection is confirmed." },
  { title: "Stake. Track. Unstake.", label: "Staking", icon: Layers3, description: "Explore ETH and SOL staking with existing sample holdings. The demo moves balances only. Real rewards, fees and unstaking periods would depend on the provider and network." },
];

export function CryptoSpotlight() {
  const [active, setActive] = useState(0);
  return <section className="m-crypto-section m-section" id="crypto">
    <div className="m-container" data-reveal>
      <div className="m-crypto-header"><span className="m-eyebrow"><Layers3 size={17} /> THE JOMBIT CRYPTO VISION</span><span className="m-status-tag">DEMO STAKING · LUNO INTEGRATION PLANNED</span></div>
      <div className="m-crypto-layout"><div className="m-crypto-copy"><h2>Your crypto.<br /><em>A staking-focused future.</em></h2><p>Put existing eligible crypto at the centre of a simpler staking experience. No buying or selling in JomBit. A Luno integration is part of our plan, not a live service.</p>
        <div className="m-crypto-options" role="tablist" aria-label="Explore the Crypto Wallet concept" aria-orientation="vertical">{cryptoFeatures.map(({ label, title, icon: Icon }, index) => <button type="button" key={label} role="tab" id={`crypto-tab-${index}`} aria-controls="crypto-panel" aria-selected={active === index} tabIndex={active === index ? 0 : -1} onClick={() => setActive(index)} onKeyDown={(event) => {
          let next = index;
          if (event.key === "ArrowDown") next = (index + 1) % 3;
          else if (event.key === "ArrowUp") next = (index + 2) % 3;
          else if (event.key === "Home") next = 0;
          else if (event.key === "End") next = 2;
          else return;
          event.preventDefault(); setActive(next); document.getElementById(`crypto-tab-${next}`)?.focus();
        }}><Icon size={21} /><span><small>{label}</small><strong>{title}</strong></span><ArrowRight size={18} /></button>)}</div>
      </div>
      <div className="m-crypto-panel" role="tabpanel" id="crypto-panel" aria-labelledby={`crypto-tab-${active}`} tabIndex={0}>
        <div className="m-crypto-panel-top"><span><Layers3 size={20} /> JomBit Crypto Staking</span><small>CONCEPT PREVIEW</small></div>
        <div className="m-crypto-scene" key={active}>
          {active === 0 && <PortfolioPreview />}
          {active === 1 && <div className="m-provider-preview"><Wallet size={36} /><h3>JomBit + Luno</h3><p>{LUNO_INTEGRATION_NOTE}</p><ul><li>Provider eligibility and approval</li><li>Secure account access, still to be designed</li><li>Clear rewards, fees and unstaking information</li></ul><a className="m-text-link" href={LUNO_STAKING_GUIDE} target="_blank" rel="noreferrer">Read Luno’s staking guide <ArrowRight size={16} /></a></div>}
          {active === 2 && <div className="m-staking-preview"><Layers3 size={39} /><span>YOUR DEMO HOLDINGS</span><div className="m-staking-balances"><div><small>Available</small><strong>4.00 <em>SOL</em></strong></div><ArrowRight size={20} /><div><small>Staked</small><strong>1.00 <em>SOL</em></strong></div></div><div className="m-staking-track"><span /><span /></div><p>5.00 SOL total · illustrative balance split</p><small>No rewards are earned in this preview.</small></div>}
          <div className="m-crypto-scene-caption"><h3>{cryptoFeatures[active].title}</h3><p>{cryptoFeatures[active].description}</p></div>
        </div>
      </div></div>
      <div className="m-crypto-bottom"><p>Separate purposes, one JomBit: fiat for everyday spending, crypto for a future staking experience.</p><a className="m-text-link" href="#wallet">Explore the fiat wallet <ArrowRight size={17} /></a></div>
      <p className="m-crypto-disclosure">Product concepts, not live financial services. No real crypto is held, traded or staked by this prototype. Luno integration is planned; no confirmed partnership or account connection is claimed. This website uses illustrative prices. Rewards are not guaranteed, crypto can lose value, and provider fees and unstaking delays may apply.</p>
    </div>
  </section>;
}
