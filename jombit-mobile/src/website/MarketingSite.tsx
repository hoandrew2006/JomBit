import { useEffect, useRef, useState } from "react";
import {
  ArrowRight, ArrowUpRight, Check, CheckCheck, Play,
  CreditCard, Globe2, HeartHandshake, Menu, QrCode, ScanLine,
  ShieldCheck, Smartphone, Sparkles, Users, Wallet, X,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Brand } from "../../app/components/ui";
import { productTabs, storeLinks } from "./content";
import { CardVisual, CurrencyVisual, GroupVisual, JourneyIcon, ReceiptVisual, SettlementVisual } from "./ProductVisuals";
import "./website.css";
import "./refresh.css";
import "./polish.css";
import { AppPreview } from "./AppPreview";
import { ReceiptJourney } from "./ReceiptJourney";
import { CryptoSpotlight } from "./CryptoSpotlight";
import { FaqAccordion } from "./FaqAccordion";
import { useSectionReveals } from "./Motion";

const navigation = [
  ["Products", "products"], ["How it works", "how-it-works"],
  ["Crypto vision", "crypto"], ["Company", "company"], ["FAQs", "faq"],
] as const;

function SectionIntro({ title, description }: { eyebrow?: string; title: string; description?: string }) {
  return <div className="m-section-intro"><h2>{title}</h2>{description && <p>{description}</p>}</div>;
}

function DownloadQr({ platform }: { platform: "ios" | "android" }) {
  const url = storeLinks[platform];
  const name = platform === "ios" ? "App Store" : "Google Play";
  const payload = url ?? `JomBit for ${platform === "ios" ? "iOS" : "Android"} is coming soon. This is a preview QR. The official ${name} download link will be added at launch.`;
  return <article className="m-download-card"><div className="m-download-platform"><Smartphone size={22} /><div><small>{platform === "ios" ? "FOR IPHONE" : "FOR ANDROID"}</small><h3>{name}</h3></div><span>{url ? "Available" : "Coming soon"}</span></div><div className="m-store-qr"><QRCodeSVG value={payload} size={154} marginSize={3} fgColor="#101a19" bgColor="#fff" title={`JomBit ${name} ${url ? "download" : "coming-soon preview"} QR code`} /></div><strong>{url ? "Scan to download JomBit" : "Your next good bit is on its way."}</strong><p>{url ? `Open your camera and follow the link to ${name}.` : "Preview QR · official store link coming at launch."}</p>{url && <a className="m-store-link" href={url} target="_blank" rel="noreferrer">Open {name} <ArrowUpRight size={15} /></a>}</article>;
}

export function MarketingSite() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const active = productTabs[activeTab];
  const siteRef = useSectionReveals();
  const headerRef = useRef<HTMLElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!menuOpen) return;
    const outside = (event: PointerEvent) => { if (!headerRef.current?.contains(event.target as Node)) setMenuOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { setMenuOpen(false); menuButtonRef.current?.focus(); } };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
  }, [menuOpen]);

  return (
    <div className="marketing-site" ref={siteRef}>
      <a className="m-skip-link" href="#main-content">Skip to content</a>
      <div className="m-announcement"><span>Meet JomBit</span> Good times deserve a better way to split. <a href="#how-it-works">Discover how <ArrowRight size={13} /></a></div>
      <header className="m-site-header" ref={headerRef}>
        <div className="m-nav-wrap"><a className="m-logo-link" href="#" aria-label="JomBit home"><Brand /></a><nav className={`m-main-nav ${menuOpen ? "is-open" : ""}`} id="site-navigation" aria-label="Main navigation">{navigation.map(([label, id]) => <a key={id} className={id === "crypto" ? "m-crypto-nav" : undefined} href={`#${id}`} onClick={() => setMenuOpen(false)}>{label}</a>)}</nav><div className="m-nav-actions"><a className="m-button m-button-small" href="#download" onClick={() => setMenuOpen(false)}><QrCode size={16} /> App launch</a><button ref={menuButtonRef} type="button" className="m-menu-toggle" aria-label={menuOpen ? "Close menu" : "Open menu"} aria-controls="site-navigation" aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X /> : <Menu />}</button></div></div>
      </header>

      <main id="main-content">
        <section className="m-hero m-container">
          <div className="m-hero-content"><span className="m-eyebrow">Shared moments. Fairer money.</span><h1><span>Split the bill.</span><span>Keep the good vibes.</span></h1><p>From mamak nights to your next getaway. Scan receipts, split fairly, and keep everyone on the same page.</p><div className="m-hero-ctas"><a className="m-button" href="?view=demo"><Play size={18} /> Try the demo</a><a className="m-text-link" href="#crypto">Explore our crypto vision <ArrowUpRight size={17} /></a></div></div>
          <AppPreview />
        </section>

        <section className="m-principles" aria-label="JomBit at a glance"><div className="m-container">{[["Item by item", "A fairer way to split"], ["To the last cent", "Tax & service included"], ["Fewer payments", "Clearer group balances"], ["Fiat + crypto", "Two wallets. One vision."]].map(([title, text]) => <div key={title}><strong>{title}</strong><span>{text}</span></div>)}</div></section>

        <ReceiptJourney />

        <section className="m-container m-section" id="products" data-reveal>
          <SectionIntro eyebrow="LESS MONEY ADMIN. MORE LIVING." title="Made for your kind of together." description="The everyday plans are the ones worth making easier." />
          <div className="m-use-cases">{[
            { type: "food" as const, title: "For the dinner crew", text: "Shared dishes. Different orders. One bill that finally makes sense to everyone.", label: "Split the receipt", tab: 0 },
            { type: "travel" as const, title: "For the next getaway", text: "From the first taxi to the last supper, keep the group’s expenses in one place.", label: "Track the whole trip", tab: 1 },
            { type: "home" as const, title: "For everyday life", text: "Groceries, house bills, coffee runs. Make sharing a little less complicated.", label: "Simplify who owes whom", tab: 2 },
          ].map((item) => <a className="m-use-case" href="#the-jombit-way" key={item.title} onClick={() => setActiveTab(item.tab)}><JourneyIcon type={item.type} /><h3>{item.title}</h3><p>{item.text}</p><span>{item.label}<ArrowUpRight size={17} /></span></a>)}</div>
        </section>

        <section className="m-feature-section" id="the-jombit-way"><div className="m-container" data-reveal>
          <SectionIntro eyebrow="THE JOMBIT WAY" title="Small details. A big difference." />
          <div className="m-product-tabs" role="tablist" aria-label="JomBit core features">{productTabs.map((tab, index) => <button key={tab.id} type="button" role="tab" id={`tab-${tab.id}`} aria-selected={activeTab === index} aria-controls="product-panel" tabIndex={activeTab === index ? 0 : -1} onClick={() => setActiveTab(index)} onKeyDown={(event) => { if (!["ArrowRight", "ArrowLeft", "Home", "End"].includes(event.key)) return; event.preventDefault(); const next = event.key === "Home" ? 0 : event.key === "End" ? productTabs.length - 1 : (index + (event.key === "ArrowRight" ? 1 : -1) + productTabs.length) % productTabs.length; setActiveTab(next); document.getElementById(`tab-${productTabs[next].id}`)?.focus(); }}>{index === 0 ? <ScanLine size={18} /> : index === 1 ? <Users size={18} /> : <CheckCheck size={18} />}{tab.label}</button>)}<span className="m-tab-indicator" aria-hidden="true" style={{ transform: `translateX(${activeTab * 100}%)` }} /></div>
          <div className="m-feature-panel" role="tabpanel" id="product-panel" aria-labelledby={`tab-${active.id}`} key={active.id} tabIndex={0}>
            <div className="m-feature-copy"><span className="m-eyebrow">{active.eyebrow}</span><h3>{active.title}</h3><p>{active.description}</p><ul>{active.points.map((point) => <li key={point}><Check size={17} /><span>{point}</span></li>)}</ul><a className="m-text-link m-link-cyan" href="#how-it-works">Follow a sample bill <ArrowRight size={17} /></a></div>
            <div className="m-feature-art">{active.id === "split" ? <ReceiptVisual /> : active.id === "track" ? <GroupVisual /> : <SettlementVisual />}</div>
          </div>
        </div></section>

        <section className="m-container m-product-status" aria-label="What works today and what is planned" data-reveal><article><span className="m-status-tag"><span /> WORKING LOCAL PROTOTYPE</span><h2>The small things, working.</h2><p>Receipt editing, item splits, group balances and debt simplification. Camera + Gemini scanning with private local setup. Ledger data stays in this browser; no live group sync yet.</p></article><article><span className="m-status-tag m-status-future">SIMULATED & PLANNED</span><h2>The bigger picture, taking shape.</h2><p>A fiat wallet, staking-focused crypto with a planned Luno integration, regional transfers and a prepaid card. Explore the journeys today; real financial services and app-store downloads are not yet available.</p></article></section>

        <CryptoSpotlight />

        <section className="m-ecosystem m-section" id="wallet"><div className="m-container m-fiat-layout" data-reveal>
          <div><SectionIntro eyebrow="THE OTHER HALF: JOMBIT FIAT WALLET" title="One MYR wallet. A wider world." description="Deposit in MYR. View the same money in SGD, THB or IDR, then review the MYR cost before a demo transfer. One balance, with conversion when you confirm—not separate pots to top up." /><span className="m-status-tag">PRODUCT VISION · SIMULATED BALANCES</span><p className="m-section-footnote">No bank connection, live exchange rates or real cross-border transfers.</p></div>
          <div className="m-fiat-preview"><Wallet size={26} /><h3>MYR in. More places in view.</h3><CurrencyVisual /><p>Fund in MYR · view estimated equivalents</p></div>
        </div></section>

        <section className="m-container m-section m-card-section" id="card" data-reveal>
          <div className="m-card-art"><CardVisual metal /><CardVisual /><span className="m-card-art-label"><CreditCard size={14} /> JOMBIT CARD CONCEPT</span></div>
          <div className="m-card-copy"><span className="m-eyebrow">THE NEXT CHAPTER: JOMBIT CARD</span><h2>From splitting<br />to <em>spending.</em></h2><p>The longer-term vision: a prepaid JomBit Card funded from your fiat wallet. Crypto remains separate for staking, not card spending. A familiar way to bring the JomBit ecosystem into everyday life.</p><div className="m-card-tiers"><div><span>Virtual</span><strong>Free</strong></div><div><span>Plastic</span><strong>RM12</strong></div><div><span>Metal</span><strong>RM30</strong></div></div><small>Concept pricing · No cards are currently issued.</small><a className="m-text-link m-link-cyan" href="#company">Explore what we’re building <ArrowRight size={17} /></a></div>
        </section>

        <section className="m-why-section m-section" id="why-jombit"><div className="m-container" data-reveal>
          <SectionIntro eyebrow="DESIGNED AROUND PEOPLE" title="Because money should never get between you." />
          <div className="m-values-grid">{[
            { icon: HeartHandshake, title: "Fairness in the details", text: "A shared bill should reflect what you actually shared. Item-level splits and proportional charges make that possible." },
            { icon: ShieldCheck, title: "Clarity for everyone", text: "See where every amount comes from. Clear breakdowns and a shared expense history keep the whole group informed." },
            { icon: Globe2, title: "Local roots. Regional vision.", text: "Inspired by everyday life in Malaysia, with an ASEAN currency and transfer vision for wherever the group goes next." },
          ].map(({ icon: Icon, title, text }) => <article key={title}><Icon size={29} /><h3>{title}</h3><p>{text}</p></article>)}</div>
        </div></section>

        <section className="m-container m-section m-company-section" id="company" data-reveal>
          <div className="m-company-copy"><span className="m-eyebrow">ABOUT JOMBIT</span><h2>We believe the best<br />things in life<br />are <em>shared.</em></h2><p>JomBit starts with a familiar moment: a table full of friends, an excellent meal, and one very complicated bill.</p><p>Our mission is to make shared money simple, fair, and easy to understand—so people can spend more time enjoying the moment and less time working out who owes what.</p><p>We’re developing a group-expense and fintech concept that connects those everyday moments to a wider wallet experience. Receipt by receipt, group by group, it begins with getting the small things right.</p></div>
          <div className="m-company-manifesto"><span className="m-company-mark"><Brand /></span><div className="m-manifesto-lines"><span>More <b>together.</b></span><span>Less <b>“you owe me.”</b></span><span>That’s <em>JomBit.</em></span></div><div className="m-company-bottom"><span>OUR PURPOSE</span><p>Good moments.<br />Shared fairly.</p><Sparkles size={25} /></div></div>
        </section>

        <section className="m-download-section" id="download"><div className="m-container m-download-layout" data-reveal>
          <div className="m-download-copy"><span className="m-eyebrow">TAKE THE GOOD BITS WITH YOU</span><h2>Your people.<br />Your plans.<br /><em>Your JomBit.</em></h2><p>One app for the shared dinners, spontaneous trips, and everyday moments in between.</p><span className="m-coming-pill"><i /> App launch coming soon</span><small>iOS and Android download QRs will connect to the official store listings at launch.</small></div>
          <div className="m-download-codes"><DownloadQr platform="ios" /><DownloadQr platform="android" /></div>
        </div></section>

        <section className="m-container m-section m-faq-section" id="faq" data-reveal><div><span className="m-eyebrow">A FEW GOOD QUESTIONS</span><h2>Let’s clear<br />things up.</h2><p>What works today.<br />What we’re building next.</p></div><FaqAccordion /></section>
      </main>

      <footer className="m-footer"><div className="m-container"><div className="m-footer-main"><div className="m-footer-brand"><Brand /><p>Good times.<br />Shared fairly.</p><span>Built around life in Malaysia.</span></div><div><h3>Discover JomBit</h3><a href="#the-jombit-way" onClick={() => setActiveTab(0)}>Receipt splitting</a><a href="#the-jombit-way" onClick={() => setActiveTab(1)}>Group expenses</a><a href="#the-jombit-way" onClick={() => setActiveTab(2)}>Simplified settlements</a></div><div><h3>The bigger picture</h3><a href="#wallet">Fiat Wallet</a><a href="#crypto">Crypto Wallet</a><a href="#card">JomBit Card</a></div><div><h3>Company</h3><a href="#company">About JomBit</a><a href="#why-jombit">Our principles</a><a href="#faq">FAQs</a><a href="#download">App launch <ArrowUpRight size={12} /></a></div></div><div className="m-footer-bottom"><span>© {new Date().getFullYear()} JomBit. Every cent, shared fairly.</span><span>Company & product concept</span></div><p className="m-footer-disclosure">JomBit is a proof of concept. Financial, crypto and card services shown are simulated or planned; no real funds move. Store downloads are coming soon. No affiliation with any bank, payment network or card issuer is claimed.</p></div></footer>
    </div>
  );
}

