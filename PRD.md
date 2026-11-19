# The Financial Crimes — Product Requirements Document (PRD v1.3)

> **Tagline:** *"All the Crimes Fit to Fine."*  
> **Document Date:** November 19, 2026  
> **Status:** Approved & In Phase 1 Execution (v1.3 — Reference-Portrait Canvas 2D Impasto Painting Engine, Wet-Oil & Archival Exhibit Interaction Aesthetic Standard + Reusable Gemini 4 Hydrogen Art Prompt)  
> **Research Synthesis:** Compiled from 4 parallel Gemini Neon deep-research tracks (US & Americas Docket, Global & India Docket, NYT UI/UX Forensic Architecture, Interactive JS Art & Automated CMS Engineering) and upgraded with the `sambitbiswas.com`-inspired Canvas 2D impasto portrait engine and museum-grade Wet-Oil & Archival Exhibit interaction grammar.

---

## 1. Executive Summary & Product Thesis

### 1.1 Vision
**The Financial Crimes** is an independent, satirical-yet-100%-factually-grounded digital broadsheet modeled on the unmistakable authority, typography, and editorial rigor of *The New York Times*. Published fresh every morning via an automated remote global sweep (**6:00 AM ET sweep** → **7:00 AM ET auto-publish**, `America/New_York`, DST-safe), it maintains a permanent, searchable running ledger exclusively covering **white-collar, corporate, regulatory, political, and billionaire/millionaire-level financial crimes** across major global financial hubs (New York, Chicago, Los Angeles, London, Mumbai, New Delhi, Frankfurt, Zurich, Singapore, Hong Kong, and beyond).

### 1.2 Core Thesis
Mainstream crime coverage disproportionately amplifies low-income street crime while burying multibillion-dollar securities frauds, money-laundering settlements, healthcare billing mills, and corporate bribery deals deep inside business sections—often with polite euphemisms ("accounting irregularities", "resolved without admitting wrongdoing"). **The Financial Crimes** flips the front page: it treats elite financial misconduct with deadpan A1 gravitas, lets primary court filings and mathematical ratios supply the satire, and visualizes the disparity between corporate wrist-slaps and ordinary criminal justice.

### 1.3 Three Signature Product Differentiators
1. **Unmistakable Broadsheet UI/UX (Flat Editorial Print Aesthetic):** Blackletter nameplate, double horizontal rules, asymmetric 70/30 homepage grid, live `LOOTED YTD` masthead ticker, regional city editions, and classic 600px serif reading columns—built with 100% open-source typography and clean parody differentiation.
2. **Zero `<img>` Photos in DOM — 100% Interactive Canvas 2D Impasto Paintings (Wet-Oil & Archival Exhibit Aesthetic):** Every photograph slot on the site renders a living **interactive JavaScript impressionist oil painting** inspired by `sambitbiswas.com`'s Canvas 2D impasto architecture (`src/painting/`): verified public-domain / Wikimedia Commons reference portraits of the actual named CEOs, defendants, prosecutors, courthouses, and exhibits (`public/paint-refs/<slug>.jpg`, mapped in `content/paint-refs.json`) are sampled *purely in memory* via `loadPixels()` and painted onto a 3-canvas stack (`ground` oil strokes + `weave` linen texture + `live` 60fps fine-print & archival layer) with Sobel contour brushstrokes, pointer-pulled facial sharpening, **The Financial Crimes' own editorial oil palette**, and our unified **Wet-Oil & Archival Exhibit** click interactions (one crisp lower-left cotton-rag exhibit plate + dignified wet-oil/fine-print surface reactions, strictly banning floating center text and cartoon particles)—generated via our reusable **Gemini 4 Hydrogen** Master Prompt (`docs/PAINTING_PROMPT.md` & `pipeline/prompts/js-painting-prompt.md`). Zero rendered `<img>` photographs, zero noisy frame chrome, zero licensing friction, and dramatically higher dwell time and shareability.
3. **Autonomous Daily Global Court & Regulatory Sweep + Running HTML CMS:** A DST-safe daily remote pipeline powered by **Gemini API / Antigravity managed remote agent** running **Gemini 4 Hydrogen** sweeps 25+ official public court and regulator feeds at **6:00 AM ET** (DOJ, SEC, CFTC, CourtListener/RECAP, SEBI, India ED/CBI, UK SFO/FCA, EU EPPO, BaFin, Singapore MAS, HK SFC), verifies facts against an immutable Atomic Fact Ledger, sources a verified open-license reference portrait/photograph into `public/paint-refs/<slug>.jpg`, lints for libel/defamation safety, drafts lean NYT-register HTML articles, generates the `content/paint-refs.json` painting config (or flagship bespoke Canvas 2D `Scene`) using `pipeline/prompts/js-painting-prompt.md`, and **auto-publishes at 7:00 AM ET** via GitHub + Cloudflare CI/CD with checks.

### 1.4 Target Audience & Success Metrics (First 90 Days)

| Metric | 30-Day Target | 90-Day Target | Measurement |
| :--- | :--- | :--- | :--- |
| **Daily Morning Docket Subscribers** (`$0/week` funnel) | 1,000 | 10,000 | Phase 1: Frontend funnel UX; Phase 3: Cloudflare Email Service (GA) + double opt-in |
| **Interactive Art Engagement Rate** | ≥ 35% of article readers | ≥ 45% | Pointer/click/scrub events on `<fc-art>` |
| **"Crime Receipt" Shares / PNG Downloads** | 250 / week | 2,000 / week | Client event on `🧾 Crime Receipt` |
| **Daily Sweep Publish SLA (7:00 AM ET)** | ≥ 95% on-time | ≥ 99% on-time | GitHub Actions workflow + CF CI/CD checks |
| **Factual / Libel Grounding Accuracy** | 100% primary-sourced | 100% primary-sourced | Zero unattributed allegations; 0 takedowns |
| **Core Web Vitals (Homepage & Article)** | LCP < 1.8s, CLS `0.000` | LCP < 1.5s, CLS `0.000` | Lighthouse / Cloudflare Web Analytics |

---

## 2. Editorial Mission, Voice & Content Policy

### 2.1 Strict Inclusion & Exclusion Scope
- **IN SCOPE (White-Collar Only):** Securities & accounting fraud, insider trading, market manipulation, Ponzi/affinity schemes, crypto/DeFi/AI-washing fraud, banking AML/BSA & sanctions lapses, corporate bribery (FCPA/FEPA/UKBA), healthcare/Medicare/Medicaid institutional billing fraud, commercial real estate/PE looting, billionaire tax evasion, public-official procurement graft, and audit/regulatory capture.
- **HARD EXCLUSIONS:** Street crime, violent crime, narcotics trafficking (unless institutional bank laundering), retail shoplifting, domestic offenses, or individual petty/benefit fraud under **$250,000** (unless involving a public official, regulator, or major corporation).

### 2.2 Editorial Voice: "Deadpan Broadsheet Authority"
- **Golden Rule:** *Never fabricate a quote, charge, defendant, or dollar figure.* The satire lives strictly in icy NYT-style understatement, structural juxtaposition (e.g., comparing a record bank fine to 26 hours of bank net income), headlines/decks, and clearly labeled commentary metrics.
- **Presumption of Innocence & Precision:** Every pre-conviction case rigorously distinguishes civil complaints from criminal indictments, attributes all allegations to named filings/prosecutors, and reproduces *"without admitting or denying"* settlement clauses verbatim.

### 2.3 Signature Editorial Metrics
1. **Slap-on-the-Wrist Score (`0–100`):** Computed *deterministically and only post-resolution* (`settlement`, `regulatory_order`, or `sentencing` — rendered as `PENDING` during active litigation):
   - **Fine-to-Loot / Fine-to-Revenue Ratio (up to 50 pts):** Penalizes civil fines representing a tiny fraction of alleged illicit gain or <1% of corporate annual revenue.
   - **No-Admission Discount (15 pts):** `+15` if settled *"without admitting or denying wrongdoing."*
   - **Executive Accountability Gap (up to 35 pts):** `+35` if zero individuals are charged/sentenced in a >$10M corporate violation; scales down relative to sentenced `prison_months`.
2. **"Compare to Street Crime" Interactive Toggle:** Embedded in articles to contrast the defendant's fine/prison outcome with standard felony consequences for a median retail theft (e.g., stealing $1,800 from a register).

---

## 3. Launch Content Lineup — Batch #1 (22 Verified 2025–2026 Cases + 2 Wire Briefs)

All 22 launch stories below are **real, verified 2025–2026 white-collar cases** grounded in primary DOJ, SEC, Treasury, SEBI, CBI, UK SFO, UK FCA, EU EPPO, BaFin, MAS, and HK SFC records.

### 3.1 Vol. I, No. 1 — Launch Homepage Programming Map

| Homepage Slot | Case # | Story | Region | Interactive JS Archetype |
| :--- | :---: | :--- | :--- | :--- |
| **Lead Package — Hero Centerpiece** | #1 | Bank of America $1.21B BSA/AML & Sanctions Settlement ($750M bundle credit) | US / D.C. | `scale-of-impunity` / `penalty-wheel` |
| **Lead Package — Live Update #1** | #2 | Backward Hat Capital $600M Forex Ponzi Scheme (SDNY Nov 2026) | US / NY | `ponzi-pyramid` |
| **Lead Package — Right Mini-Lead** | #13 | SEBI vs. Jane Street ₹4,843.57 Cr (~$553M) Bank Nifty Manipulation | India / Mumbai | `pump-dump-ticker` |
| **Lead Package — "More to Read" 2×2** | #6, #7, #16, #21 | Do Kwon 15 Yrs; Nate "0% AI" App; CBI Sting of SFIO Officer; Singapore MAS 9-Bank 0.91% Fine | Global | Mini-Canvas `thumb` Mode |
| **Secondary Package #1 (Wall St & Law)** | #3 | 30-Person Global BigLaw M&A Insider Trading Ring (D. Mass / SEC) | US / NY & MA | `shell-network` |
| **Secondary Package #2 (Europe & Asia)** | #19 | EPPO Operation Hermes: 62 Detained in €410M Smartphone VAT Carousel | EU (8 Nations) | `offshore-flight-map` |
| **Right Rail — 2×2 Feature Spotlight** | #4 | Bradley Heppner / GWG $150M Conviction & Unprivileged Claude AI Chats | US / NY & TX | `redacted-dossier` |
| **Right Rail — 2-Col Visual Cards** | #5, #14 | Chad Monroe's $42M Medicare Yacht *"The Rogue Shark"*; Gensol EV Loan → Camellias Condo | US / FL & India | `editorial-vignette` & `shell-network` |
| **Right Rail — Opinion Column Lead** | #8 | Roger Ver ("Bitcoin Jesus") $49.9M Exit-Tax DPA w/ 0 Prison Days | US / LA | `scale-of-impunity` (Monochrome) |
| **Business Day / Global Ledger Grid** | #9–#12, #15, #17–#18, #20, #22 | Madigan, TIGO/Scoular, Nightingale, Frank/Javice, IndusInd, AOG Technics, Korfuzi, BaFin/JPM, PwC/Evergrande | Global | Full 8-Archetype Rotation |

---

### 3.2 US & Americas Batch #1 (12 Verified Cases)

| # | Case & Defendants | Venue / Agency | Status (2025–2026) | Loot / Scale vs. Penalty | Deadpan NYT Headline | Art Archetype & Concept |
| :-: | :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | **Bank of America, N.A.** | Treasury: FinCEN, OCC, OFAC (`sb0657`) | Settled **Oct 13, 2026** (civil consent orders; **0 execs charged**) | **>$5B** late SARs (Chinese MLNs & border) + 475 sanctions violations vs. **$1.21B** net fine (OCC's $750M credited toward FinCEN's $1.2B!) | *Bank of America Admits to Willful Laundering Lapses, Receives $750 Million Bundle Discount on Record Fine* | `penalty-wheel`: "Regulatory Coupon Clipper" toggling stacked ($1.96B) vs. bundled ($1.21B) fine vs. 2 weeks net income |
| **2** | **Backward Hat Capital** (Phillip Williams & Devin Johnson) | SDNY (USAO-SDNY) | Indicted / Unsealed **Nov 2026** (pending trial) | **~$600M** raised from 2,000+ retail investors promising >6% monthly forex returns (>100%/yr) | *Firm Named 'Backward Hat Capital' Accused of Operating $600 Million Currency Ponzi Scheme* | `ponzi-pyramid` + compounding curve showing 6%/mo eclipsing Earth's GDP by Year 18 |
| **3** | **Global BigLaw M&A Ring** (Nicolo Nourafchan, Robert Yadgarov + 28 others) | D. Mass (Boston) & SEC | Unsealed **May 2026** (19 arrested; 2 fugitives abroad; 1 guilty plea) | **Tens of millions** in illicit profits across **~30 mega-M&A deals** (>$140B deal value incl. Anadarko, Express Scripts, iRobot) | *Thirty Charged in Decade-Long Scheme to Monetize Confidential BigLaw Merger Files* | `shell-network`: Interactive force graph linking Law Firms A–E → tippers → middlemen → 30 traders |
| **4** | **Bradley Heppner** (Ex-Chair, GWG Holdings; CEO, Beneficient) | SDNY (`25-Cr.-503`, Judge Rakoff) | **Convicted all counts May 7, 2026**; sentencing pending | **$150M+** looted from bankrupt GWG L-Bond retail investors into shell entity HCLP | *Executive Convicted of Looting $150 Million From Public Firm Learns Chatbot Is Not His Lawyer* | `redacted-dossier`: "Privilege Check" contrasting $1,800/hr BigLaw counsel vs. unprivileged Claude chatbot prompts |
| **5** | **2026 Health Care Takedown** (455 defs) + **Chad Monroe** (Maksix Medical) | DOJ Fraud Section & M.D. Fla (56 districts) | Takedown **June 23, 2026**; Monroe **pleaded guilty Nov 13, 2026** | **$6.5B+** national takedown ($21.1B w/ 2025 sweep); Monroe **$42M** brace/genetic fraud → seized **47-ft yacht *"The Rogue Shark"*** | *Man Who Named His Medicare-Funded Yacht 'The Rogue Shark' Pleads Guilty in $42 Million Scheme* | `editorial-vignette`: 56-district map + "Billing-to-Yacht" converter (phantom knee braces → yacht/NFL box) |
| **6** | **Do Kwon** (Co-founder & CEO, Terraform Labs) | SDNY (Judge Engelmayer) | **Sentenced Dec 11, 2025** (pleaded guilty Aug 2025) | **$40B** TerraUSD/LUNA wipeout vs. **15 years prison** (~$7.3M investor loss per day served) | *Architect of $40 Billion Crypto Collapse Receives 15 Years, or $7.3 Million in Losses per Day Served* | `scale-of-impunity`: "Dollars-Per-Prison-Day Leaderboard" ranking Kwon, Mashinsky, Karony, Javice & BofA |
| **7** | **Albert Saniger** (Founder & ex-CEO, Nate, Inc.) | SDNY & SEC | Indicted & sued **Apr 9, 2025**; criminal trial proceeding 2026 | **$42M+** raised claiming 93–97% AI automation (actual rate: **~0%**; humans in Manila & Romania typed orders) | *Shopping App's 'Proprietary Neural Network' Was Actually a Night Shift in Manila, Prosecutors Say* | `editorial-vignette`: X-ray slider peeling back "Neural Net Processing..." to reveal manual checkout operators |
| **8** | **Roger Ver** ("Bitcoin Jesus") | CDCA (Los Angeles) & DOJ Tax | **DPA Oct 14, 2025**; indictment moved for dismissal | **~$48M** alleged 2014 exit-tax evasion vs. **$49.9M** paid + **0 prison days** | *Early Bitcoin Evangelist Settles Decade-Old Exit Tax Indictment With Check and Zero Prison Time* | `scale-of-impunity`: "Expatriation Carry Trade Calculator" comparing 2014 BTC deferral vs. W-2 penalties |
| **9** | **Michael J. Madigan** (Former IL House Speaker / ComEd) | NDIL (Chicago) & 7th Circuit | Sentenced **June 2025** (92 mos); **7th Cir. affirmed Apr 2026** | ~$1.3M no-show ComEd jobs for **$150M+** utility legislation vs. **7.5 yrs + $2.5M fine** (ComEd paid $200M) | *Appeals Court Upholds Conviction of Former Illinois Speaker Who Outsourced Patronage to Electric Utility* | `shell-network`: "No-Show Payroll Flowchart" tracing ratepayer bills → ward captains → Springfield votes |
| **10** | **TIGO Guatemala**, **The Scoular Co.** & **First FEPA Charge** | SDFL (Miami) & DOJ Fraud Section | TIGO DPA **Nov 2025**; Scoular DPA **July 2026**; FEPA **Nov 2026** | TIGO **$118.2M** (50% discount, no monitor; cash bags + cartel link); Scoular **$10.18M** (MX border bribes) | *After Brief Moratorium on Bribery Cases, Justice Dept. Resumes Enforcement — Provided Cartels Are in the Supply Chain* | `offshore-flight-map`: Post-Blanche Memo FCPA decision tree & Latin America supply-chain map |
| **11** | **Elie Schwartz** (Ex-CEO, Nightingale Properties, NYC) | NDGA (Atlanta) & SEC | **Sentenced May 2025** (guilty plea) | **$62.8M** from 800+ CrowdStreet investors spent on watches/margin trades vs. **87 mos + $45M+ restitution** | *Real Estate Executive Who Bought Luxury Watches Instead of Atlanta Office Tower Gets Seven Years* | `shell-network`: "Escrow vs. Reality" animated Sankey contrasting pitch deck vs. forensic bank traces |
| **12** | **Charlie Javice & Olivier Amar** (Frank / JPMorgan) | SDNY (Judge Hellerstein) | Convicted Mar 2025; Javice **sentenced Sept 29, 2025** | **$175M** JPMorgan buyout using $18K spreadsheet of 4M fake students vs. **85 mos prison** | *Founder Who Sold JPMorgan Four Million Imaginary College Students Is Sentenced to Seven Years* | `redacted-dossier`: "M&A Diligence Audit" clicking *Send Test Email* triggers 70%+ bounce explosion ($41.18/fake row) |

---

### 3.3 International Batch #1 — India, UK, Europe & Asia-Pacific (10 Flagship Cases + 2 Wire Briefs)

| # | Case & Defendants | City / Agency | Status (2025–2026) | Amount Involved vs. Penalty | Deadpan NYT Headline | Art Archetype & Concept |
| :-: | :--- | :--- | :--- | :--- | :--- | :--- |
| **13** | **SEBI vs. Jane Street Group** (4 trading affiliates) | **Mumbai** — SEBI & SAT | Interim ban July 2025; escrow paid; **SAT reserved order Oct 21, 2026** | **₹4,843.57 Cr (~$553M–$565M)** alleged Bank Nifty / Nifty 50 expiry-day manipulation gains impounded in escrow | *Wall Street's Quietest Quant Giants Discover Mumbai's Options Pit Has a Cover Charge* | `pump-dump-ticker`: "Expiry-Day Seesaw Simulator" scrubbing 9:15 AM–3:30 PM IST cash surge vs. short-option unwind |
| **14** | **Gensol Engineering & BluSmart** (Anmol & Puneet Jaggi) | **Mumbai / Gurugram** — SEBI, SAT, NCLT, ED, SFIO | Market/director bans confirmed **July 30, 2025**; NCLT insolvency & ED/SFIO probes active 2026 | **₹977.75 Cr (~$114M)** state EV loans (IREDA/PFC) → **₹42.94 Cr (~$5M)** routed via Go-Auto to DLF *The Camellias* flat + golf clubs | *Borrowed for Electric Cabs, Parked in Gurugram's Most Exclusive Driveway* | `shell-network`: "Follow the Green Rupee" Sankey tracing state EV loans → Go-Auto → Capbridge → Camellias condo |
| **15** | **IndusInd Bank Derivatives & Insider Trading** (Sumant Kathpalia, Arun Khurana + 3 execs) | **Mumbai** — SEBI, SAT, RBI, SFIO | Interim order **May 28, 2025**; exec resignations, ESOP clawbacks, SAT & SFIO active 2026 | **~₹2,000 Cr (~$230M)** FX derivatives net-worth hole (-27% stock drop); **₹19.78 Cr (~$2.3M)** avoided insider losses frozen | *Before Telling Shareholders About a $230 Million Hole, Bank Chiefs Found Time to Sell* | `pump-dump-ticker`: "UPSI Stock-Sale Overlay" plotting internal email warnings + exec sales before the -27% cliff |
| **16** | **CBI Sting of SFIO Deputy Director** (Harish Kumar Tanwar, IRS + 2) | **New Delhi / Chennai** — CBI & Rouse Avenue Court | **Arrested red-handed Oct 12–13, 2026**; remanded in custody | Demanded **₹1 Cr (~$115K)** bribe (**₹20L / $23K** seized in trap) to shield accused in multi-thousand-crore **DHFL** probe | *At India's Serious Fraud Office, an Investigator Offers a Private Settlement Plan* | `editorial-vignette`: "Enforcement Matryoshka" interactive nested layers (DHFL → SFIO → Bribe → CBI Trap → Court) |
| **17** | **AOG Technics** (Jose Alejandro Zamora Yrala) | **London / Surrey** — UK SFO & Southwark Crown Court | Guilty plea Dec 2025; **sentenced Feb 23, 2026** | **£39.3M (~$50M)** across **60,000+ jet engine parts** w/ forged airworthiness certs vs. **4 yrs 8 mos prison** | *From a Spare Bedroom in Surrey, a One-Man Supply Chain Grounded the World's Jetliners* | `redacted-dossier`: "Spot the Fake Jet-Part Form 1" interactive forged certificate inspector + global fleet tally |
| **18** | **Redinel & Oerta Korfuzi** (ex-Janus Henderson analyst & sister) | **London** — UK FCA & Southwark Crown Court | Convicted June 2025; **sentenced July 4, 2025**; POCA confiscation 2026 | **~£1M (~$1.25M)** WFH insider trading + 173 cash deposits to Albania / Knightsbridge vault vs. **11 combined yrs** (record) | *Working From Home Offered Flexibility, Including Minutes Between Confidential Emails and Leveraged Bets* | `offshore-flight-map` / timeline: "4-Minute Trade Clock" + London-to-Albania cash-box trail |
| **19** | **EPPO "Operation Hermes"** (62 detained across 2 syndicates) | **EU (8 Nations)** — EPPO (PT, ES, IT, AT, FR, DE, MT, NL) | **300+ dawn raids Oct 7, 2026**; pre-trial detentions & freezes active Nov 2026 | **€410M+ (~$445M)** smartphone VAT carousel loss vs. **€310M** freezing orders + €9M physical seizures | *The Same Smartphones Toured Eight European Countries, Collecting Tax Refunds at Every Stop* | `offshore-flight-map`: "Spin the VAT Carousel" looping one phone crate across 8 EU borders while tax refunds climb |
| **20** | **J.P. Morgan SE (Germany)** | **Frankfurt** — BaFin | Final binding order **Oct 30, 2025** (announced Nov 6, 2025) | Systematic 12-month failure to file Suspicious Transaction Reports without undue delay vs. **€45M (~$49M)** record BaFin fine | *JPMorgan's European Hub Takes Its Time Reporting Suspicious Money, Setting a German Fine Record* | `penalty-wheel`: Measuring Germany's all-time record AML fine in hours of JPMorgan Chase global net income |
| **21** | **MAS 9-Bank Money Laundering Penalties** (Credit Suisse, UOB, UBS, Citi, Julius Baer, LGT, etc.) | **Singapore** — MAS | Finalized **July 4, 2025**; FATF criticized fines as too low in 2025–2026 | **S$3.0B (~$2.25B)** laundered ("Fujian gang") vs. **S$27.45M (~$21.5M)** combined fines (**0.915% of loot!**) | *Nine Elite Banks Helped Move $2.25 Billion in Dirty Cash; Singapore Sends a $21.5 Million Bill* | `scale-of-impunity`: "The 0.91% Rounding Error" 10,000-pixel grid showing all 9 bank fines as less than 1 row |
| **22** | **PwC Hong Kong — China Evergrande Audits** | **Hong Kong** — SFC, AFRC & High Court | Sanctioned **Apr 23, 2026**; **$8.4B liquidator suit** & settlement challenge active Nov 2026 | **HK$1.3B (~$167M)** (HK$300M AFRC fine + HK$1B SFC fund + 6-mo PIE ban) vs. **US$8.4B** liquidator claim | *PwC Pays $167 Million to Put Evergrande's Audits Behind It; Evergrande's Liquidators Present an $8.4 Billion Tab* | `scale-of-impunity`: "Evergrande Creditor Queue & Audit Rubber-Stamp" comparing HK$1.3B vs. US$8.4B claim |

*Bonus Verified Wire Briefs:* Switzerland **Trafigura Beheer BV** (`SK.2023.49`, first-ever Swiss criminal foreign-bribery conviction of a major commodity trader) & UAE **CBUAE** Oct 2026 record **AED 200M (~$54.4M)** bank AML fine + personal CEO/MLRO penalties.

---

## 4. UI/UX & Broadsheet Design System

### 4.1 Homepage Masthead & Asymmetric Grid Architecture (`max-width: 1200px`)
1. **Top Utility Strip (`38px`):** Search toggle, centered edition switcher (`U.S. | NEW YORK | CHICAGO | L.A. | LONDON | INDIA | GLOBAL`), right satirical CTAs (`SUBSCRIBE FOR $0/WEEK` & `TIP LINE` in `#567b95`).
2. **Masthead Row:** Left date + `Today's Docket`, center **The Financial Crimes** (`Chomsky` / `UnifrakturMaguntia`, `52px`), right live cycling ticker (`LOOTED YTD $14.8B ↑` / `AVG FINE/LOOT 4.2% ↓`).
3. **Section Navigation + Double Rule:** `Wall Street`, `Crypto & AI`, `Courts`, `India & Asia`, `Europe`, `Politics`, `Opinion` | `The Ledger`, `Interactive`, `Archive` above a classic `1px + 2px + 1px` `#121212` double rule.
4. **Main Well (`834px` / ~70%) + Vertical Hairline (`#dfdfdf`) + Right Rail (`334px` / ~30%):**
   - Bordered Featured Lead Package Box (`1px solid #121212`) with `"These white-collar crimes are free to read."`, `26% / 48% / 26%` 3-column upper layout (`LIVE` updates + `4:5` Hero Interactive JS Canvas + Crime Metric Ticker Box & secondary lead), and bottom `"More to read for free."` 2×2 grid with `84×84` mini-canvases.
   - Secondary Horizontal Section Packages (`35% / 65%` Analysis + `16:9` JS centerpiece).
   - Right Rail: 2×2 interactive blueprint collage + feature story, 2-col visual mini-cards with `‹ ›` carousel controls, and `Opinion` stack.

### 4.2 Three Page Templates
- **Standard News Article (`/article/<slug>`):** Sticky compact header + beat sub-nav, `600px` `Newsreader` H1 + deck + action bar (`Audio Briefing`, `🧾 Crime Receipt`, Share, Save, Comments), `945px` interactive JS centerpiece, etched avatars + byline, `600px` `Source Serif 4` (`20px / 1.55`) prose with **"Compare to Street Crime"** card and **"Read the Indictment"** source box.
- **Opinion Column (`/opinion/<slug>`):** Minimal header, centered terracotta `OPINION` eyebrow, columnist small-caps, dramatic `52px` `Instrument Serif` display headline, high-contrast monochrome interactive JS centerpiece, drop-cap body.
- **Running Ledger & Archive (`/ledger`):** Sticky multi-facet Pagefind filter bar (Search, City, Crime Type, Dollar Magnitude, Slap-on-the-Wrist ratio, Sort), live aggregate strip, and toggle between Editorial List and Spreadsheet Ledger.

### 4.3 Design Tokens (`tokens.css` — 100% SIL OFL Open-Source Fonts)
```css
:root {
  --fc-bg-page: #ffffff;
  --fc-bg-newsprint: #f6f3ec;
  --fc-ink-primary: #121212;
  --fc-ink-body: #222222;
  --fc-ink-muted: #5a5a5a;
  --fc-rule-strong: #121212;
  --fc-rule-column: #dfdfdf;
  --fc-rule-light: #ebebeb;
  --fc-accent-slate: #567b95;
  --fc-accent-slate-dark: #326891;
  --fc-accent-crimson: #d0021b;
  --fc-art-crimson: #a62626;
  --fc-art-slate: #2b4c6f;
  --fc-art-gold: #b5892e;
  --fc-art-sage: #3d6b59;
  --fc-font-masthead: 'Chomsky', 'UnifrakturMaguntia', Georgia, serif;
  --fc-font-headline: 'Newsreader', Georgia, serif;
  --fc-font-opinion: 'Instrument Serif', 'Newsreader', Georgia, serif;
  --fc-font-body: 'Source Serif 4', Georgia, serif;
  --fc-font-sans: 'Libre Franklin', -apple-system, BlinkMacSystemFont, sans-serif;
  --fc-font-mono: 'JetBrains Mono', ui-monospace, monospace;
}
```

---

## 5. Interactive JavaScript Impasto Portrait Painting Engine & Interaction Aesthetic Standard (v1.3)

- **Three-Canvas Impasto Stack (`src/painting/`, `<fc-painting>` via `src/components/FcArt.astro`):**
  1. **`ground` canvas:** Cumulative 3-pass oil brushstrokes (`paintDab` in `brush.ts`: cast shadow edge `l - 16`, thick rounded oil body `l`, 70% specular highlight ridge `l + 14`, plus 2% impressionist broken-color flecks suppressed in monochrome Opinion mode).
  2. **`weave` canvas:** Static 180×180 procedural linen warp/weft tile (`weave.ts`) composited via `mix-blend-mode: multiply`.
  3. **`live` canvas:** 60fps fine-print & archival exhibit layer cleared every frame for dignified editorial engraving marks and the lower-left Archival Exhibit Plate.
- **Reference-Portrait Sampling & Sobel Contour Tangents (`portrait-scene.ts`):**
  - Each article maps to a verified public-domain / Wikimedia Commons JPEG in `public/paint-refs/<slug>.jpg` (normalized max `320px`, RGB JPEG, ~16–40KB; the painter samples at 180px) via `content/paint-refs.json` — prioritizing actual portraits of named principals (e.g., Brian Moynihan, Jamie Dimon, Do Kwon, Roger Ver, Michael Madigan, Hui Ka Yan, Laura Codruța Kövesi, Todd Blanche) and iconic landmarks/exhibits (CFM56 jet engine, Sunseeker yacht, Patek Philippe watch, Dalal Street BSE, Southwark/Moakley/Thurgood Marshall courthouses, Marina Bay).
  - **Zero `<img>` elements ever enter the DOM:** `loadPixels(url, 180)` decodes pixels strictly in memory, computes a 3×3 smoothed Sobel luminance-gradient tangent field (`angles = atan2(gy, gx) + π/2`), and lets oil strokes curve naturally around cheekbones, hairlines, lapels, and architecture.
  - **Pointer-Pulled Focus (`HOTSPOT_SHARE = 0.62`):** Coarse-to-fine underpainting eases into continuous fine detail (`detail: 0.45`) around the reader's pointer, idle `focalPoint` (the subject's eyes), and active wet-oil interaction zones so glazes/gilding/redaction/waves visibly paint and heal in real oil brushwork.
- **The Financial Crimes Editorial Oil Palette (`FC_OIL` in `palette.ts`):** Six mood profiles (`verdict-crimson`, `bullion-gold`, `subpoena-cobalt`, `banknote-emerald`, `courtroom-ochre`, and mandatory `monochrome-noir` for Opinion pages) grounded on warm newsprint cream (`#F6F3EC`) — distinct from `sambitbiswas.com`'s bright toy-shelf palette.
- **Unified "Wet-Oil & Archival Exhibit" Interaction Aesthetic Standard (v1.3 — *NYT Magazine* × *The New Yorker* × Museum Print):**
  - **Hard Visual Prohibitions (Explicitly Outlawed Forever):** Zero floating drop-shadow typography over the middle of a painting or over a subject's face (`g.fillText` in mid-air or rising like arcade XP numbers); zero cartoon clipart or arcade particles (no bouncing gold Mario coins, no tumbling triangle-flap envelopes, no chunky dashed radar rings, no star/sparkle bursts, no glowing yellow laser tips, no giant rotated stamp boxes with ink-splatter rays); zero rounded SaaS pills, glowing blurs, neon SaaS colors, raw ISO timestamps, or HUD widgets overlaid on the canvas.
  - **Layer 1 — Shared Lower-Left Archival Exhibit Plate (`drawArchivalPlate`):** Every click interaction anchors factual satire (`toyText` + `toySubtext`) inside ONE crisp museum/broadsheet exhibit tag pinned to the lower-left inset (`#faf7f0` cotton-rag paper at 94% opacity, sharp `0px` corners, `1px solid #121212` hairline border, `3px` left pigment bar in the story's `FC_OIL` accent, refined `Newsreader` 600 serif headline + muted `JetBrains Mono` 500 uppercase subline, calm `6px` settle over 220ms, max 1 plate visible at a time — never obscuring faces).
  - **Layer 2 — Six Dignified Painterly / Fine-Print Surface Reactions (`toyKind` on Click/Poke):**
    1. `stamp` — Subtle circular letterpress registration seal (`1.2px` double hairline ring + fine crosshairs) + quiet local pigment oil glaze painted in `sample()`.
    2. `coins` — **24k Gold-Leaf Impasto Gilding** painted directly into the portrait's oil brushstrokes in `sample()` (following real Sobel contours, gradually repainted by maintenance strokes) + whisper-fine metallic foil flecks.
    3. `redaction` — **Wet Lampblack Impasto Censor Bar** painted directly into `sample()` with **zero text on the bar**; hovering physically brushes/repaints the portrait right back through.
    4. `crash-line` — **Fine-Nib Editorial Engraving Plunge Curve** (`1.5px` Verdict Crimson stroke + `0.75px` dashed peak-baseline hairline + crisp peak/floor vertex dots).
    5. `envelopes` — **Forensic Investigative Routing Arcs** (`1px` curved architectural ink paths + ringed archival pinpoint nodes).
    6. `gavel-ripple` — **Optical Chiaroscuro Wave** (annular wave inside `sample()` momentarily shifting oil brushwork into stark monochrome broadsheet chiaroscuro + 2 razor-thin `1px` continuous hairline rings).
- **Reusable Gemini 4 Hydrogen Master Prompt:** Documented in full in `docs/PAINTING_PROMPT.md` and stored in machine-interpolable form at `pipeline/prompts/js-painting-prompt.md` for both automated 6:00 AM ET sweeps (Mode A: `content/paint-refs.json` entry) and flagship one-off custom Canvas 2D scenes (Mode B: TypeScript `Scene`), enforcing the v1.3 Wet-Oil & Archival Exhibit standard and strict legal-stage libel guardrails.
- **Performance & Accessibility:** Single shared `requestAnimationFrame` clock (`loop.ts`), `IntersectionObserver` pause when offscreen, tuned `hero` / `inline` / `thumb` budgets (`buildSeconds: 0.7s` on thumbs so 20+ homepage paintings glide at 60fps), DPR capped at `2`, `CLS = 0.000`, and `prefers-reduced-motion: reduce` instant static paint with calm static Archival Exhibit Plate rendering and 4s `INTERACTION_GRACE` on click.

---

## 6. Web Stack, HTML-First Running CMS & Daily Automation

- **Stack:** **Astro 5 (Static Output) + Git-Backed HTML/JSON Ledger CMS + Cloudflare Workers with Static Assets (`wrangler.jsonc`, static assets served from `dist/`) + Pagefind**.
- **Directory Layout:** `content/articles/YYYY/MM/<slug>/{meta.json, body.html}` + `content/paint-refs.json` & `public/paint-refs/<slug>.jpg` (reference images sampled strictly in memory) + immutable `content/editions/YYYY-MM-DD.json` & `latest.json` snapshots (`Today's Paper` / `Yesterday's Paper`) + `content/ledger/rollup-stats.json`.
- **AI Engine for Daily Remote Sweep:** **Gemini API / Antigravity managed remote agent** powered by **Gemini 4 Hydrogen** for both (a) deep white-collar crime primary-source research, fact-grounding, and lean NYT-register article drafting, AND (b) bespoke **interactive Canvas 2D impasto painting** configuration (`content/paint-refs.json`) and flagship custom `Scene` generation driven by `pipeline/prompts/js-painting-prompt.md` (`docs/PAINTING_PROMPT.md`).
- **Daily DST-Safe Schedule (GitHub Actions `timezone: 'America/New_York'`):**
  - **6:00 AM ET (Morning Research & Art Sweep):** Polls 25+ US & global public feeds (DOJ JSON API, SEC RSS & EDGAR EFTS, CFTC, federal CM/ECF RSS feeds, CourtListener v4, OCC/FinCEN/OFAC, FINRA, NY AG, FTC/CFPB, SEBI, PIB/ED/CBI, Indian Kanoon, UK SFO JSON/Atom, UK FCA, EPPO/OLAF/ESMA, BaFin, PNF, FINMA, MAS, HK SFC/AFRC, DFSA/WAM, GDELT, OpenSanctions) → cross-agency deduplication → white-collar filter → **Gemini 4 Hydrogen** research & Atomic Fact Ledger grounding → lean NYT-voice `body.html` + Wikimedia Commons / public-domain reference portrait sourcing (`public/paint-refs/<slug>.jpg`, normalized max 320px RGB JPEG) + **Gemini 4 Hydrogen** impasto painting config (`content/paint-refs.json` via `pipeline/prompts/js-painting-prompt.md`) → deterministic schema/libel validation (`npm run validate:content`, `npm run check`, `npm run build`) → stages edition branch/PR.
  - **7:00 AM ET (Auto-Publish Press Run):** Final delta check → merges validated daily edition into `main` → GitHub Actions CI + Cloudflare CI/CD auto-deploys `dist/` (Astro 5 + Pagefind index) to **Cloudflare Workers with Static Assets**.
- **CI/CD & Quality Gates:** GitHub Actions (`.github/workflows/ci.yml`) enforces `npm ci`, `npm run validate:content`, `npm run check`, and `npm run build` on every pull request and push to `main`, gating Cloudflare automatic deployment.
- **Newsletter Architecture (Phase 3 — Deferred):** Phase 1 is **website-only** (the frontend `$0/week` subscribe modal remains active as non-blocking broadsheet funnel UX with no backend wired yet). Phase 3 will wire **Cloudflare Email Service (GA)** for automated 7:00 AM ET **Morning Docket** email delivery.
- **Monthly Indie Run Rate:** **~$10–$30/month** (Cloudflare Workers Static Assets `$0–$5`, GitHub Actions `$0`, Gemini API / Gemini 4 Hydrogen remote sweep `~$10–$20`, Phase 3 Cloudflare Email Service GA `$0–$5`).

---

## 7. Legal Safety & Web Funnel Guardrails

- **Fair Report Privilege:** 100% anchored to official government/court filings with primary-source citations and docket numbers.
- **Hard Fact/Satire Wall:** Zero fabricated quotes, charges, or numbers; strict deterministic linter blocks unattributed criminal language on pre-conviction/civil cases and enforces *"without admitting or denying"* clauses; failing articles quarantine automatically.
- **Living Acquittal Watcher:** Weekly CourtListener check flags dismissals/acquittals for immediate top-of-article Case Update Banners.
- **Funnel Mechanics:** Satirical `$0/week` non-paywall modal (Phase 1 frontend UX; Phase 3 **Cloudflare Email Service (GA)** **Morning Docket** delivery at 7:00 AM ET) + viral **`🧾 Crime Receipt`** PNG card + public-record Tip Line UX.

---

## 8. Phased Roadmap

1. **Phase 1 (Launch — Website-Only): Broadsheet UI, Canvas 2D Impasto Portrait Engine & Batch #1 Launch** — Astro 5 + Cloudflare Workers with Static Assets (`wrangler.jsonc`), full NYT-inspired CSS design system with crisp AP/NYT date & guilt-admission formatting, `sambitbiswas.com`-style Canvas 2D impasto painting engine (`src/painting/`, 22 verified Wikimedia/public-domain reference portraits in `public/paint-refs/` + `content/paint-refs.json`, zero `<img>` tags in DOM, v1.3 **Wet-Oil & Archival Exhibit** interaction standard with shared lower-left Archival Exhibit Plate + 6 dignified wet-oil/fine-print surface reactions), 22 lean verified launch articles, Pagefind Ledger, animated physical thermal Crime Receipt printer & PNG generator, reusable Gemini 4 Hydrogen Master Painting Prompt (`docs/PAINTING_PROMPT.md` & `pipeline/prompts/js-painting-prompt.md`), frontend `$0/week` subscribe & tip-line UX (no newsletter backend yet), GitHub + Cloudflare CI/CD checks.
2. **Phase 2: Automated 6:00 AM ET Sweep → 7:00 AM ET Auto-Publish Pipeline** — Gemini API / Antigravity managed remote agent powered by **Gemini 4 Hydrogen** for daily 25+ feed global research, Atomic Fact Ledger grounding, libel linting, lean NYT-register drafting, Wikimedia/gov reference portrait sourcing (`public/paint-refs/<slug>.jpg`), and interactive Canvas 2D impasto painting generation (`content/paint-refs.json` + bespoke `Scene` modules via `pipeline/prompts/js-painting-prompt.md`), auto-publishing at 7:00 AM ET via GitHub Actions + Cloudflare CI/CD.
3. **Phase 3: Cloudflare Email Service (GA) Newsletter & Live Operations** — Wire **Cloudflare Email Service (GA)** for automated 7:00 AM ET **The Morning Docket** email delivery, double opt-in `/api/subscribe` & Turnstile-protected `/api/tip`, regional RSS feeds, and weekly acquittal/correction watcher.
