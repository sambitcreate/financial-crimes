# The Financial Crimes — Product Requirements Document (PRD v1.4)

> **Tagline:** *"All the Crimes Fit to Fine."*  
> **Document Date:** November 20, 2026  
> **Status:** Phase 1 Complete & Production-Hardened (v1.4 — Modular Canvas 2D Impasto Engine, Wet-Oil & Archival Exhibit Standard, CC BY/BY-SA Attribution, `sanitize-html` Security Boundary, Vitest Test Suite, Trust/SEO/RSS Infrastructure)  
> **Research Synthesis:** Compiled from 4 parallel deep-research tracks (US & Americas Docket, Global & India Docket, Broadsheet UI/UX Architecture, Interactive Canvas & Static CMS Engineering) and refined through independent editorial, security, accessibility, and CI/CD hardening.

---

## 1. Executive Summary & Product Thesis

### 1.1 Vision
**The Financial Crimes** is an independent, satirical-yet-100%-factually-grounded digital broadsheet modeled on the unmistakable authority, typography, and editorial rigor of *The New York Times*. Designed around a permanent, searchable running ledger exclusively covering **white-collar, corporate, regulatory, political, and billionaire/millionaire-level financial crimes** across major global financial hubs (New York, Chicago, Los Angeles, London, Mumbai, New Delhi, Frankfurt, Zurich, Singapore, Hong Kong, and beyond), Phase 1 launches with 22 verified primary-sourced cases and prepares a DST-safe Phase 2 daily sweep (**6:00 AM ET sweep** → **7:00 AM ET auto-publish**, `America/New_York`).

### 1.2 Core Thesis
Mainstream crime coverage disproportionately amplifies low-income street crime while burying multibillion-dollar securities frauds, money-laundering settlements, healthcare billing mills, and corporate bribery deals deep inside business sections—often with polite euphemisms ("accounting irregularities", "resolved without admitting wrongdoing"). **The Financial Crimes** flips the front page: it treats elite financial misconduct with deadpan A1 gravitas, lets primary court filings and mathematical ratios supply the satire, and visualizes the disparity between corporate wrist-slaps and ordinary criminal justice.

### 1.3 Three Signature Product Differentiators
1. **Unmistakable Broadsheet UI/UX (Flat Editorial Print Aesthetic):** Blackletter nameplate, double horizontal rules, asymmetric 70/30 homepage grid, live `LOOTED YTD` masthead ticker, regional city editions, and classic 600px serif reading columns—built with 100% SIL OFL open-source typography and clean parody differentiation.
2. **Zero `<img>` Photos in DOM — 100% Interactive Canvas 2D Impasto Paintings (Wet-Oil & Archival Exhibit Aesthetic):** Every photograph slot on the site renders a living **interactive JavaScript impressionist oil painting** inside `<fc-painting>` (`src/painting/`): verified public-domain / Wikimedia Commons reference portraits of the actual named CEOs, defendants, prosecutors, courthouses, and exhibits (`public/paint-refs/<slug>.jpg`, max `320px`, `> 5 KB` RGB JPEG, mapped 1:1 in `content/paint-refs.json` with mandatory CC BY / CC BY-SA attribution) are sampled *purely in memory* via `loadPixels(url, 180)` and painted onto a 3-canvas stack (`ground` oil strokes + `weave` linen texture + `live` 60fps fine-print & archival layer) with Sobel contour brushstrokes, pointer-pulled facial sharpening, **The Financial Crimes' own editorial oil palette (`FC_OIL`)**, full keyboard & screen-reader accessibility, and our unified **Wet-Oil & Archival Exhibit** click interactions (one crisp lower-left cotton-rag exhibit plate + 6 dignified wet-oil/fine-print surface reactions, strictly banning floating center text and cartoon particles)—documented in `docs/PAINTING_PROMPT.md` & `pipeline/prompts/js-painting-prompt.md`.
3. **Git-Backed HTML Ledger CMS + Phase 2 Autonomous Daily Sweep:** Articles live as versioned `content/articles/YYYY/MM/<slug>/{meta.json, body.html}` files validated by strict Zod schemas (`src/schemas/article.ts`), build-time `sanitize-html` (`src/utils/sanitize.ts`), and Vitest (`npm test`). Phase 1 includes the Gemini **Slap-on-the-Wrist Score** judge (`pipeline/judge-wrist-slap.mjs`) and the `pipeline/run-sweep.mjs` audit/orchestration scaffold; Phase 2 wires 25+ global court/regulator feed fetchers, automated 320px portrait sourcing, and PR-based daily publishing.

### 1.4 Target Audience & Success Metrics (First 90 Days)

| Metric | 30-Day Target | 90-Day Target | Measurement |
| :--- | :--- | :--- | :--- |
| **Daily Morning Docket / RSS Subscribers** (`$0/week`) | 1,000 | 10,000 | Phase 1: `/rss.xml` + honest preview modal; Phase 3: Cloudflare Email Service (GA) + double opt-in |
| **Interactive Art Engagement Rate** | ≥ 35% of article readers | ≥ 45% | Pointer/click/keyboard events on `<fc-painting>` |
| **"Crime Receipt" Shares / PNG Downloads** | 250 / week | 2,000 / week | Client event on `🧾 Crime Receipt` |
| **Daily Sweep Publish SLA (Phase 2, 7:00 AM ET)** | ≥ 95% on-time | ≥ 99% on-time | GitHub Actions workflow + Cloudflare CI/CD checks |
| **Factual / Libel Grounding Accuracy** | 100% primary-sourced | 100% primary-sourced | Zero unattributed allegations; 0 takedowns |
| **Core Web Vitals (Homepage & Article)** | LCP < 1.8s, CLS `0.000` | LCP < 1.5s, CLS `0.000` | Lighthouse / Cloudflare Web Analytics |

---

## 2. Editorial Mission, Voice & Content Policy

### 2.1 Strict Inclusion & Exclusion Scope
- **IN SCOPE (White-Collar Only):** Securities & accounting fraud, insider trading, market manipulation, Ponzi/affinity schemes, crypto/DeFi/AI-washing fraud, banking AML/BSA & sanctions lapses, corporate bribery (FCPA/FEPA/UKBA), healthcare/Medicare/Medicaid institutional billing fraud, commercial real estate/PE looting, billionaire tax evasion, public-official procurement graft, and audit/regulatory capture.
- **HARD EXCLUSIONS:** Street crime, violent crime, narcotics trafficking (unless institutional bank laundering), retail shoplifting, domestic offenses, or individual petty/benefit fraud under **$250,000** (unless involving a public official, regulator, or major corporation).

### 2.2 Editorial Voice: "Deadpan Broadsheet Authority"
- **Golden Rule:** *Never fabricate a quote, charge, defendant, or dollar figure.* The satire lives strictly in icy NYT-style understatement, structural juxtaposition (e.g., comparing a record bank fine to hours of bank net income), headlines/decks, and clearly labeled commentary metrics.
- **Presumption of Innocence & Precision:** Every pre-conviction case rigorously distinguishes civil complaints from criminal indictments, attributes all allegations to named filings/prosecutors, reproduces *"without admitting or denying"* settlement clauses verbatim, and carries a strict schema-enforced `legal_stage` enum (`investigation`, `civil_complaint`, `indicted`, `arrested`, `interim_order`, `guilty_plea`, `convicted`, `sentenced`, `settlement`, `regulatory_order`, `dpa`, `appeal`, `dismissed`, `acquitted`).

### 2.3 Signature Editorial Metrics
1. **Slap-on-the-Wrist Score (`0–100`):** Never hand-entered. Judged by Gemini via [`pipeline/judge-wrist-slap.mjs`](./pipeline/judge-wrist-slap.mjs) against the rubric in [`pipeline/prompts/wrist-slap-judge.md`](./pipeline/prompts/wrist-slap-judge.md) (`temperature: 0`, structured JSON output) and written to `meta.json` (`slap_on_wrist_score`). Scored **only for resolved stages** (`settlement`, `regulatory_order`, `sentenced`, `dpa`); every other stage is written as `null` and rendered as `PENDING`:
   - **Fine-to-Loot / Fine-to-Revenue Ratio (up to 50 pts):** Penalizes civil fines representing a tiny fraction of alleged illicit gain or <1% of corporate annual revenue.
   - **No-Admission Discount (15 pts):** `+15` if settled *"without admitting or denying wrongdoing"* (`admitted_guilt === false` on a civil settlement, regulatory order, or DPA).
   - **Executive Accountability Gap (up to 35 pts):** `+35` if zero individuals are charged/sentenced in a >$10M corporate violation; scales down relative to sentenced `prison_months`.
2. **"Compare to Street Crime" Interactive Toggle:** Embedded in articles to contrast the defendant's fine/prison outcome with standard felony consequences for a median street offense (e.g., structuring $18,000 in cash deposits or retail theft).

---

## 3. Launch Content Lineup — Batch #1 (22 Verified 2025–2026 Cases)

All 22 launch stories below are **real, verified 2025–2026 white-collar cases** grounded in primary DOJ, SEC, Treasury, SEBI, CBI, UK SFO, UK FCA, EU EPPO, BaFin, MAS, and HK SFC records, each paired 1:1 with a normalized `<= 320px` open-license reference JPEG in `public/paint-refs/<slug>.jpg` and an entry in `content/paint-refs.json`.

### 3.1 Vol. I, No. 1 — Launch Homepage Programming Map

| Homepage Slot | Case # | Story | Region | Impasto Portrait (`paletteMood` · `toyKind`) |
| :--- | :---: | :--- | :--- | :--- |
| **Lead Package — Hero Centerpiece** | #1 | Bank of America $1.21B BSA/AML & Sanctions Settlement ($750M bundle credit) | US / D.C. | Brian Moynihan portrait (`verdict-crimson` · `stamp`) |
| **Lead Package — Live Update #1** | #2 | Backward Hat Capital $600M Forex Ponzi Scheme (SDNY Nov 2026) | US / NY | NYSE facade (`verdict-crimson` · `crash-line`) |
| **Lead Package — Right Mini-Lead** | #13 | SEBI vs. Jane Street ₹4,843.57 Cr (~$553M) Bank Nifty Manipulation | India / Mumbai | BSE Phiroze Jeejeebhoy Towers (`verdict-crimson` · `crash-line`) |
| **Lead Package — "More to Read" 2×2** | #6, #7, #16, #21 | Do Kwon 15 Yrs; Nate "0% AI" App; CBI Sting of SFIO Officer; Singapore MAS 9-Bank 0.915% Fine | Global | `thumb` impasto canvases (`crash-line`, `redaction`, `envelopes`, `coins`) |
| **Secondary Package #1 (Wall St & Law)** | #3 | 30-Person Global BigLaw M&A Insider Trading Ring (D. Mass / SEC) | US / NY & MA | Moakley U.S. Courthouse (`subpoena-cobalt` · `envelopes`) |
| **Secondary Package #2 (Europe & Asia)** | #19 | EPPO Operation Hermes: 62 Detained in €410M Smartphone VAT Carousel | EU (8 Nations) | Laura Codruța Kövesi portrait (`subpoena-cobalt` · `gavel-ripple`) |
| **Right Rail — Feature Spotlight** | #4 | Bradley Heppner / GWG $150M Conviction & Unprivileged AI Chats | US / NY & TX | Thurgood Marshall Courthouse (`subpoena-cobalt` · `redaction`) |
| **Right Rail — 2-Col Visual Cards** | #5, #14, #17, #22 | Chad Monroe's *"The Rogue Shark"*; Gensol EV Loan → Camellias Condo; AOG Technics Jet Parts; PwC Evergrande | Global | Impasto scroll-snap rail (`coins`, `coins`, `stamp`, `stamp`) |
| **Right Rail — Opinion Column Lead** | #8, #20 | Roger Ver $49.9M Exit-Tax DPA (0 Prison Days); BaFin €45M JPMorgan Fine | US / LA & Frankfurt | Monochrome portraits: Roger Ver & Jamie Dimon (`monochrome-noir` · `stamp`) |
| **Business Day / Global Ledger Grid** | #9–#12, #15, #18 | Madigan, TIGO/Scoular, Nightingale, Frank/Javice, IndusInd, Korfuzi | Global | Full 6-mood / 6-`toyKind` impasto rotation |

---

### 3.2 US & Americas Batch #1 (12 Verified Cases)

| # | Case & Defendants | Venue / Agency | Status (2025–2026) | Loot / Scale vs. Penalty | Deadpan Broadsheet Headline | Impasto Painting (`paletteMood` · `toyKind`) |
| :-: | :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | **Bank of America, N.A.** | Treasury: FinCEN, OCC, OFAC (`sb0657`) | Settled **Oct 13, 2026** (civil consent orders; **0 execs charged**) | **>$5B** late SARs + 475 sanctions lapses vs. **$1.21B** net fine ($750M OCC credit) | *Bank of America Admits to Willful Laundering Lapses, Receives $750 Million Bundle Discount on Record Fine* | Brian Moynihan portrait (`verdict-crimson` · `stamp`: `$750M DISCOUNT` / `0 EXECS CHARGED`) |
| **2** | **Backward Hat Capital** (Phillip Williams & Devin Johnson) | SDNY (USAO-SDNY) | Indicted / Unsealed **Nov 2026** (pending trial) | **~$600M** raised from 2,000+ retail investors promising >6% monthly forex returns | *Firm Named 'Backward Hat Capital' Accused of Operating $600 Million Currency Ponzi Scheme* | NYSE facade (`verdict-crimson` · `crash-line`: `6%/MO ALLEGED` / `INDICTED · PENDING TRIAL`) |
| **3** | **Global BigLaw M&A Ring** (Nicolo Nourafchan, Robert Yadgarov + 28 others) | D. Mass (Boston) & SEC | Unsealed **May 2026** (19 arrested; 2 fugitives abroad; 1 guilty plea) | **Tens of millions** in illicit profits across **~30 mega-M&A deals** (>$140B deal value) | *Thirty Charged in Decade-Long Scheme to Monetize Confidential BigLaw Merger Files* | Moakley U.S. Courthouse (`subpoena-cobalt` · `envelopes`: `30 CHARGED` / `INDICTED · D. MASS`) |
| **4** | **Bradley Heppner** (Ex-Chair, GWG Holdings; CEO, Beneficient) | SDNY (`25-Cr.-503`, Judge Rakoff) | **Convicted all counts May 7, 2026**; sentencing pending | **$150M+** looted from bankrupt GWG L-Bond retail investors into shell entity HCLP | *Executive Convicted of Looting $150 Million From Public Firm Learns Chatbot Is Not His Lawyer* | Thurgood Marshall Courthouse (`subpoena-cobalt` · `redaction`: `NO AI PRIVILEGE` / `CONVICTED ALL COUNTS`) |
| **5** | **2026 Health Care Takedown** + **Chad Monroe** (Maksix Medical) | DOJ Fraud Section & M.D. Fla (56 districts) | Takedown **June 23, 2026**; Monroe **pleaded guilty Nov 13, 2026** | **$6.5B+** national takedown; Monroe **$42M** brace/genetic fraud → seized **47-ft yacht *"The Rogue Shark"*** | *Man Who Named His Medicare-Funded Yacht 'The Rogue Shark' Pleads Guilty in $42 Million Scheme* | Luxury motor yacht (`bullion-gold` · `coins`: `47-FT YACHT SEIZED` / `GUILTY PLEA · $42M`) |
| **6** | **Do Kwon** (Co-founder & CEO, Terraform Labs) | SDNY (Judge Engelmayer) | **Sentenced Dec 11, 2025** (pleaded guilty Aug 2025) | **$40B** TerraUSD/LUNA wipeout vs. **15 years prison** (~$7.3M investor loss per day served) | *Architect of $40 Billion Crypto Collapse Receives 15 Years, or $7.3 Million in Losses per Day Served* | Do Kwon portrait (`verdict-crimson` · `crash-line`: `$40B COLLAPSE` / `15 YRS · $7.3M/DAY`) |
| **7** | **Albert Saniger** (Founder & ex-CEO, Nate, Inc.) | SDNY & SEC | Indicted & sued **Apr 9, 2025**; criminal trial proceeding 2026 | **$42M+** raised claiming 93–97% AI automation (actual rate: **~0%**; humans in Manila & Romania) | *Shopping App's 'Proprietary Neural Network' Was Actually a Night Shift in Manila, Prosecutors Say* | Metro Manila night skyline (`subpoena-cobalt` · `redaction`: `~0% AI ALLEGED` / `INDICTED · TRIAL PENDING`) |
| **8** | **Roger Ver** ("Bitcoin Jesus") | CDCA (Los Angeles) & DOJ Tax | **DPA Oct 14, 2025**; indictment moved for dismissal | **~$48M** alleged 2014 exit-tax evasion vs. **$49.9M** paid + **0 prison days** | *Early Bitcoin Evangelist Settles Decade-Old Exit Tax Indictment With Check and Zero Prison Time* | Roger Ver portrait (`monochrome-noir` · `stamp`: `0 PRISON DAYS` / `$49.9M CHECK · D.P.A.`) |
| **9** | **Michael J. Madigan** (Former IL House Speaker / ComEd) | NDIL (Chicago) & 7th Circuit | Sentenced **June 2025** (92 mos); **7th Cir. affirmed Apr 2026** | ~$1.3M no-show ComEd jobs for **$150M+** utility legislation vs. **7.5 yrs + $2.5M fine** (ComEd paid $200M) | *Appeals Court Upholds Conviction of Former Illinois Speaker Who Outsourced Patronage to Electric Utility* | Michael Madigan portrait (`courtroom-ochre` · `gavel-ripple`: `APPEAL DENIED` / `92 MOS · $200M COMED`) |
| **10** | **TIGO Guatemala**, **The Scoular Co.** & **First FEPA Charge** | SDFL (Miami) & DOJ Fraud Section | TIGO DPA **Nov 2025**; Scoular DPA **July 2026**; FEPA **Nov 2026** | TIGO **$118.2M** (50% discount, no monitor); Scoular **$10.18M** (MX border bribes) | *After Brief Moratorium on Bribery Cases, Justice Dept. Resumes Enforcement — Provided Cartels Are in the Supply Chain* | Deputy AG Todd Blanche portrait (`courtroom-ochre` · `stamp`: `50% D.P.A. DISCOUNT` / `NO COMPLIANCE MONITOR`) |
| **11** | **Elie Schwartz** (Ex-CEO, Nightingale Properties, NYC) | NDGA (Atlanta) & SEC | **Sentenced May 2025** (guilty plea) | **$62.8M** from 800+ CrowdStreet investors spent on watches/margin trades vs. **87 mos + $45M+ restitution** | *Real Estate Executive Who Bought Luxury Watches Instead of Atlanta Office Tower Gets Seven Years* | Gold Swiss dress wristwatch (`bullion-gold` · `coins`: `$62.8M DIVERTED` / `87 MOS · LUXURY WATCHES`) |
| **12** | **Charlie Javice & Olivier Amar** (Frank / JPMorgan) | SDNY (Judge Hellerstein) | Convicted Mar 2025; Javice **sentenced Sept 29, 2025** | **$175M** JPMorgan buyout using $18K spreadsheet of 4M fake students vs. **85 mos prison** | *Founder Who Sold JPMorgan Four Million Imaginary College Students Is Sentenced to Seven Years* | JPMorgan Chase HQ tower (`verdict-crimson` · `envelopes`: `4M FAKE STUDENTS` / `85 MOS PRISON`) |

---

### 3.3 International Batch #1 — India, UK, Europe & Asia-Pacific (10 Flagship Cases)

| # | Case & Defendants | City / Agency | Status (2025–2026) | Amount Involved vs. Penalty | Deadpan Broadsheet Headline | Impasto Painting (`paletteMood` · `toyKind`) |
| :-: | :--- | :--- | :--- | :--- | :--- | :--- |
| **13** | **SEBI vs. Jane Street Group** (4 trading affiliates) | **Mumbai** — SEBI & SAT | Interim ban July 2025; escrow paid; **SAT reserved order Oct 21, 2026** | **₹4,843.57 Cr (~$553M–$565M)** alleged Bank Nifty / Nifty 50 expiry-day manipulation gains impounded in escrow | *Wall Street's Quietest Quant Giants Discover Mumbai's Options Pit Has a Cover Charge* | BSE Phiroze Jeejeebhoy Towers (`verdict-crimson` · `crash-line`: `₹4,844 CR ESCROW` / `APPEAL PENDING`) |
| **14** | **Gensol Engineering & BluSmart** (Anmol & Puneet Jaggi) | **Mumbai / Gurugram** — SEBI, SAT, NCLT, ED, SFIO | Market/director bans confirmed **July 30, 2025**; NCLT insolvency & ED/SFIO probes active 2026 | **₹977.75 Cr (~$114M)** state EV loans → **₹42.94 Cr (~$5M)** routed to DLF *The Camellias* flat + golf clubs | *Borrowed for Electric Cabs, Parked in Gurugram's Most Exclusive Driveway* | DLF towers, Gurugram (`banknote-emerald` · `coins`: `₹978 CR EV LOANS` / `SEBI BAN · PROBES ACTIVE`) |
| **15** | **IndusInd Bank Derivatives & Insider Trading** (Sumant Kathpalia, Arun Khurana + 3 execs) | **Mumbai** — SEBI, SAT, RBI, SFIO | Interim order **May 28, 2025**; exec resignations, ESOP clawbacks, SAT & SFIO active 2026 | **~₹2,000 Cr (~$230M)** FX derivatives net-worth hole (-27% stock drop); **₹19.78 Cr (~$2.3M)** frozen | *Before Telling Shareholders About a $230 Million Hole, Bank Chiefs Found Time to Sell* | Bandra Kurla Complex, Mumbai (`subpoena-cobalt` · `crash-line`: `$230M FX HOLE` / `SEBI ORDER · APPEAL ACTIVE`) |
| **16** | **CBI Sting of SFIO Deputy Director** (Harish Kumar Tanwar, IRS + 2) | **New Delhi / Chennai** — CBI & Rouse Avenue Court | **Arrested red-handed Oct 12–13, 2026**; remanded in custody | Demanded **₹1 Cr (~$115K)** bribe (**₹20L / $23K** seized in trap) in **DHFL** probe | *At India's Serious Fraud Office, an Investigator Offers a Private Settlement Plan* | Shastri Bhawan, New Delhi (`courtroom-ochre` · `envelopes`: `₹20L STING TRAP` / `ARRESTED · PRESUMED INNOCENT`) |
| **17** | **AOG Technics** (Jose Alejandro Zamora Yrala) | **London / Surrey** — UK SFO & Southwark Crown Court | Guilty plea Dec 2025; **sentenced Feb 23, 2026** | **£39.3M (~$50M)** across **60,000+ jet engine parts** w/ forged airworthiness certs vs. **4 yrs 8 mos prison** | *From a Spare Bedroom in Surrey, a One-Man Supply Chain Grounded the World's Jetliners* | CFM56 commercial turbofan (`subpoena-cobalt` · `stamp`: `FORGED FORM 1` / `4 YRS 8 MOS PRISON`) |
| **18** | **Redinel & Oerta Korfuzi** (ex-Janus Henderson analyst & sister) | **London** — UK FCA & Southwark Crown Court | Convicted June 2025; **sentenced July 4, 2025**; POCA confiscation 2026 | **~£1M (~$1.25M)** WFH insider trading + 173 cash deposits to Albania vs. **11 combined yrs** (record) | *Working From Home Offered Flexibility, Including Minutes Between Confidential Emails and Leveraged Bets* | Southwark Crown Court (`courtroom-ochre` · `gavel-ripple`: `4-MIN TRADE GAP` / `11 YRS COMBINED`) |
| **19** | **EPPO "Operation Hermes"** (62 detained across 2 syndicates) | **EU (8 Nations)** — EPPO (PT, ES, IT, AT, FR, DE, MT, NL) | **300+ dawn raids Oct 7, 2026**; pre-trial detentions & freezes active Nov 2026 | **€410M+ (~$445M)** smartphone VAT carousel loss vs. **€310M** freezing orders + €9M physical seizures | *The Same Smartphones Toured Eight European Countries, Collecting Tax Refunds at Every Stop* | Laura Codruța Kövesi portrait (`subpoena-cobalt` · `gavel-ripple`: `€410M VAT PROBE` / `62 DETAINED · 8 NATIONS`) |
| **20** | **J.P. Morgan SE (Germany)** | **Frankfurt** — BaFin | Final binding order **Oct 30, 2025** (announced Nov 6, 2025) | Systematic 12-month STR reporting delays vs. **€45M (~$49M)** record BaFin fine | *JPMorgan's European Hub Takes Its Time Reporting Suspicious Money, Setting a German Fine Record* | Jamie Dimon portrait (`monochrome-noir` · `stamp`: `€45M RECORD FINE` / `≈ 9 HRS NET INCOME`) |
| **21** | **MAS 9-Bank Money Laundering Penalties** (Credit Suisse, UOB, UBS, Citi, Julius Baer, LGT, etc.) | **Singapore** — MAS | Finalized **July 4, 2025**; FATF criticized fines as too low in 2025–2026 | **S$3.0B (~$2.25B)** laundered ("Fujian gang") vs. **S$27.45M (~$21.5M)** combined fines (**0.915% of loot**) | *Nine Elite Banks Helped Move $2.25 Billion in Dirty Cash; Singapore Sends a $21.5 Million Bill* | Marina Bay skyline (`banknote-emerald` · `coins`: `0.915% FINE` / `0 EXECS JAILED`) |
| **22** | **PwC Hong Kong — China Evergrande Audits** | **Hong Kong** — SFC, AFRC & High Court | Sanctioned **Apr 23, 2026**; **$8.4B liquidator suit** active Nov 2026 | **HK$1.3B (~$167M)** (HK$300M AFRC fine + HK$1B SFC fund + 6-mo PIE ban) vs. **US$8.4B** claim | *PwC Pays $167 Million to Put Evergrande's Audits Behind It; Evergrande's Liquidators Present an $8.4 Billion Tab* | Hui Ka Yan portrait (`bullion-gold` · `stamp`: `$167M vs $8.4B` / `6-MONTH AUDIT BAN`) |

---

## 4. UI/UX & Broadsheet Design System

### 4.1 Homepage Masthead & Asymmetric Grid Architecture (`max-width: 1200px`)
1. **Top Utility Strip (`38px`):** Search toggle, centered edition switcher (`U.S. | NEW YORK | CHICAGO | L.A. | LONDON | INDIA | GLOBAL`), right satirical CTAs (`SUBSCRIBE FOR $0/WEEK` & `TIP LINE` in `#567b95`), plus swipe-to-dismiss navigation drawer (`NavDrawer.astro`) reading live `edition.volume`.
2. **Masthead Row:** Left date + `Today's Docket`, center **The Financial Crimes** (`Chomsky` / `UnifrakturMaguntia`, `52px`), right live cycling ticker (`LOOTED YTD` / `AVG FINE/LOOT`).
3. **Section Navigation + Double Rule:** `Wall Street`, `Crypto & AI`, `Courts`, `India & Asia`, `Europe`, `Politics`, `Opinion` | `The Ledger`, `Interactive`, `Archive` above a classic `1px + 2px + 1px` `#121212` double rule.
4. **Main Well (`834px` / ~70%) + Vertical Hairline (`#dfdfdf`) + Right Rail (`334px` / ~30%):**
   - Bordered Featured Lead Package Box (`1px solid #121212`) with `"These white-collar crimes are free to read."`, `26% / 48% / 26%` 3-column upper layout (`LIVE` updates + `4:5` Hero Interactive Impasto Canvas [`4:3` on mobile] + Crime Metric Ticker Box & secondary lead), and bottom `"More to read for free."` 2×2 grid with `84×84` mini-canvases.
   - Secondary Horizontal Section Packages (`35% / 65%` Analysis + `16:9` impasto centerpiece).
   - Right Rail: Feature spotlight, scroll-snap 2-col visual mini-cards with `‹ ›` carousel controls, and `Opinion` stack.

### 4.2 Page Templates & Trust / Syndication Routes
- **Standard News Article (`/article/<slug>`):** Sticky compact header, `600px` `Newsreader` H1 + deck + tight action bar (`🧾 Crime Receipt`, read time, `Share`, `Save`), `945px` interactive `<fc-painting>` centerpiece with CC attribution caption, etched avatars + byline, `600px` `Source Serif 4` (`20px / 1.55`) sanitized prose with **"Compare to Street Crime"** card, **"Read the Indictment"** primary-source box, and `NewsArticle` JSON-LD.
- **Opinion Column (`/opinion/<slug>`):** Minimal header, centered terracotta `OPINION` eyebrow, columnist small-caps, dramatic `52px` `Instrument Serif` display headline, high-contrast `monochrome-noir` `<fc-painting>` centerpiece, drop-cap body, and `NewsArticle` JSON-LD.
- **Running Ledger & Archive (`/ledger`):** Sticky multi-facet Pagefind filter bar (Search, City, Crime Type, Dollar Magnitude, Slap-on-the-Wrist ratio, Sort), live aggregate strip, and toggle between Editorial List and Spreadsheet Ledger.
- **Historical Edition Snapshot (`/edition/<YYYY-MM-DD>`):** Reproduces any archived daily edition from `content/editions/<date>.json` with dynamic `edition.volume`.
- **Editorial Trust, Transparency & Syndication Pages:**
  - **`/about`:** Editorial Mission, Hard Fact/Satire Wall, Slap-on-the-Wrist Scoring Rubric, Fair Report Privilege, Independence Colophon (not affiliated with NYT), and the complete **Reference Portrait CC Attribution Table** generated from `content/paint-refs.json`.
  - **`/corrections`:** Corrections Policy, Acquittal & Dismissal Update Protocol, Right of Reply (direct submissions coming soon), and live Corrections Log reading any `article.corrections` entries.
  - **`/rss.xml` & `/sitemap-index.xml`:** Automated `@astrojs/rss` feed and `@astrojs/sitemap`, paired with `public/robots.txt`, `public/og-card.png` (`1200×630` OpenGraph / Twitter card on every route), `public/favicon.svg`, `NewsMediaOrganization` JSON-LD, and Cloudflare security/cache headers in `public/_headers`.

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

## 5. Interactive JavaScript Impasto Portrait Painting Engine & Accessibility Standard (v1.4)

- **Modular Three-Canvas Impasto Stack (`src/painting/`, `<fc-painting>` via `src/components/FcArt.astro`):**
  - Clean single-responsibility modules: `types.ts`, `palette.ts`, `color.ts`, `noise.ts`, `brush.ts`, `weave.ts`, `pixel-field.ts`, `archival-plate.ts`, `toys.ts`, `portrait-scene.ts`, `engine.ts`, `loop.ts`, `element.ts`, `refs-loader.ts`, `fc-art.css`.
  1. **`ground` canvas:** Cumulative 3-pass oil brushstrokes (`paintDab`: cast shadow edge `l - 16`, thick rounded oil body `l`, 70% specular highlight ridge `l + 14`, plus 2% impressionist broken-color flecks suppressed in monochrome Opinion mode).
  2. **`weave` canvas:** Static 180×180 procedural linen warp/weft tile (`weave.ts`) composited via `mix-blend-mode: multiply`.
  3. **`live` canvas:** 60fps fine-print & archival exhibit layer cleared every frame for dignified editorial engraving marks and the lower-left Archival Exhibit Plate.
- **Reference-Portrait Sampling, Sobel Contour Tangents & Mandatory CC Attribution:**
  - Each article maps 1:1 to a verified public-domain / Wikimedia Commons JPEG in `public/paint-refs/<slug>.jpg` (normalized max `320px`, `> 5 KB` RGB JPEG; sampled at `180px`) via `content/paint-refs.json` with required `https://` `sourceUrl` and `sourceLicense` rendered automatically in `FcArt.astro` captions and on `/about`.
  - **Zero `<img>` elements ever enter the DOM:** `loadPixels(url, 180)` decodes pixels strictly in memory, computes a 3×3 smoothed Sobel luminance-gradient tangent field (`angles = atan2(gy, gx) + π/2`), and curves brushstrokes naturally around cheekbones, hairlines, lapels, and architecture.
  - **Pointer-Pulled Focus (`HOTSPOT_SHARE = 0.62`):** Coarse-to-fine underpainting eases into continuous fine detail (`detail: 0.45`) around the reader's pointer, idle `focalPoint`, and active wet-oil interaction zones.
- **The Financial Crimes Editorial Oil Palette (`FC_OIL` in `palette.ts`):** Six mood profiles (`verdict-crimson`, `bullion-gold`, `subpoena-cobalt`, `banknote-emerald`, `courtroom-ochre`, and mandatory `monochrome-noir` for Opinion pages) grounded on warm newsprint cream (`#F6F3EC`).
- **Unified "Wet-Oil & Archival Exhibit" Interaction Aesthetic Standard (*NYT Magazine* × *The New Yorker* × Museum Print):**
  - **Hard Visual Prohibitions:** Zero floating drop-shadow typography over the center of a painting or a subject's face; zero cartoon clipart or arcade particles; zero rounded SaaS pills, glowing blurs, neon colors, raw ISO timestamps, or HUD widgets overlaid on the canvas.
  - **Layer 1 — Shared Lower-Left Archival Exhibit Plate (`drawArchivalPlate`):** Single lower-left cotton-rag exhibit tag (`#faf7f0` @ 94%, `0px` sharp corners, `1px solid #121212` border, `3px` left `FC_OIL` pigment bar, `Newsreader` 600 + `JetBrains Mono` 500, calm 220ms `6px` settle, max 1 plate visible at a time).
  - **Layer 2 — Six Dignified Painterly / Fine-Print Surface Reactions (`toyKind`):**
    1. `stamp` — Subtle circular letterpress registration seal (`1.2px` double hairline ring + crosshairs) + quiet local pigment oil glaze in `sample()`.
    2. `coins` — **24k Gold-Leaf Impasto Gilding** in `sample()` + whisper-fine metallic foil flecks.
    3. `redaction` — **Wet Lampblack Impasto Censor Bar** in `sample()` with **zero text on the bar**; hovering brushes the portrait back through.
    4. `crash-line` — **Fine-Nib Editorial Engraving Plunge Curve** (`1.5px` Verdict Crimson + `0.75px` dashed baseline + peak/floor dots).
    5. `envelopes` — **Forensic Investigative Routing Arcs** (`1px` curved architectural ink paths + ringed archival pinpoint nodes).
    6. `gavel-ripple` — **Optical Chiaroscuro Wave** in `sample()` + 2 razor-thin `1px` continuous hairline rings.
  - **Adaptive Local-Luminance Contrast:** `sampleLocalLuminance()` selects `'screen'` ivory/gilt ink on dark grounds (`< 0.48`) vs. `'multiply'` press-black/pigment ink on light grounds (`>= 0.48`), isolated via `g.save()`/`g.restore()`.
- **Keyboard, Screen-Reader & Reduced-Motion Accessibility:**
  - Interactive (`mode !== 'thumb'`) paintings expose a focusable canvas stage (`tabindex="0"`, `aria-roledescription="interactive oil painting"`, `:focus-visible` ring), activate on `Enter` / `Space`, and announce the active exhibit plate via a visually-hidden `role="status" aria-live="polite"` live region. `mode="thumb"` stays non-focusable inside link cards.
  - Single shared `requestAnimationFrame` clock (`loop.ts`), `IntersectionObserver` offscreen pause, DPR capped at `2`, `CLS = 0.000`, and instant static paint under `prefers-reduced-motion: reduce`.

---

## 6. Web Stack, Security Boundary, Testing & Automation

- **Stack:** **Astro 5 (`output: 'static'`, `build.format: 'file'`, `trailingSlash: 'never'`, `@astrojs/sitemap`, `@astrojs/rss`) + Git-Backed HTML/JSON Ledger CMS + Cloudflare Workers with Static Assets (`wrangler.jsonc`, `html_handling: "drop-trailing-slash"`, `public/_headers`) + Pagefind + Vitest**.
- **Directory Layout:** `content/articles/YYYY/MM/<slug>/{meta.json, body.html}` + `content/paint-refs.json` & `public/paint-refs/<slug>.jpg` + immutable `content/editions/YYYY-MM-DD.json` & `latest.json` snapshots + `content/ledger/rollup-stats.json`.
- **Security & Data Integrity Boundary:**
  - Build-time `sanitize-html` (`src/utils/sanitize.ts`) sanitizes every article `body.html` inside the memoized loader (`src/loaders/articles.ts`), and `scripts/validate-content.mjs` fails CI on any disallowed tag/attribute, `javascript:`/`data:` URI, non-`https:` source URL, invalid `legal_stage`, or missing 1:1 `paint-refs.json` / JPEG entry.
  - **Vitest (`npm test`):** Automated unit tests under `tests/` cover HTML sanitization & XSS bypass attempts, Zod schemas, URL safety, formatting helpers, and painting utilities.
- **CI/CD & Quality Gates (`.github/workflows/ci.yml`):**
  - Enforces top-level `permissions: { contents: read }`, `npm ci`, `npm run validate:content`, `npm test`, `npm run check`, and `npm run build` on every pull request and push to `main`.
  - Uploads verified `dist/` via `actions/upload-artifact@v4` and deploys that exact artifact in `deploy-cloudflare` when `vars.CLOUDFLARE_DEPLOY_ENABLED == 'true'` (or deploys directly via Cloudflare Workers Git Integration).
- **Phase 2 Daily Sweep Automation (Antigravity Scheduled Automation — `gemini-4-neon-high`):**
  - Instead of a GitHub Actions cron workflow, the daily 6:00 AM ET (`America/New_York`) sweep runs as an **Antigravity Scheduled Automation** (`Financial Crimes — Daily Morning Sweep`) on **Gemini 4 Neon (High)**.
  - Each morning it researches verified global white-collar filings, drafts strict fact-locked HTML + `meta.json`, sources and normalizes `<= 320px` Wikimedia Commons reference JPEGs with CC attribution, updates `content/editions/` & `rollup-stats.json`, runs `npm run validate:content && npm test && npm run check && npm run build`, commits & pushes to `main` (triggering Cloudflare deployment to `https://financialcrimes.fyi`).
- **Sign-Ups & Tip Line (Phase 3 — Coming Soon):** Phase 1 and Phase 2 remain **website-only** with zero email addresses exposed. Subscribe and Tip Line modals clearly display **Coming Soon** alongside the live `/rss.xml` feed. Phase 3 wires **Cloudflare Email Service (GA)** for automated email digest delivery and public-filing tip intake.
- **Monthly Indie Run Rate:** **~$0–$15/month** (Cloudflare Workers Static Assets `$0–$5`, GitHub Actions CI `$0`, Antigravity scheduled automation, Phase 3 Cloudflare Email Service GA `$0–$5`).

---

## 7. Legal Safety & Web Funnel Guardrails

- **Fair Report Privilege:** 100% anchored to official `https://` government/court filings with primary-source citations and docket numbers.
- **Hard Fact/Satire Wall:** Zero fabricated quotes, charges, or numbers; strict `legal_stage` enum and editorial/art libel guardrails block premature guilt labels on pre-conviction/civil cases and preserve *"without admitting or denying"* clauses verbatim.
- **Corrections & Living Acquittal Protocol:** Dedicated `/corrections` page with live `article.corrections` log (direct submission intake coming soon); Phase 3 adds a weekly automated CourtListener acquittal/dismissal watcher.
- **Funnel Mechanics:** Live `/rss.xml` feed + viral **`🧾 Crime Receipt`** thermal printer & PNG card (`FINANCIALCRIMES.FYI`) + clean **Coming Soon** notices on Subscribe & Tip Line modals.

---

## 8. Phased Roadmap

1. **Phase 1 (Complete — Live on `https://financialcrimes.fyi`):** Astro 5 static broadsheet (`format: 'file'`, `trailingSlash: 'never'`), Cloudflare Workers Static Assets (`wrangler.jsonc`, custom domains `financialcrimes.fyi` + `www.financialcrimes.fyi`, `public/_headers`), modular Canvas 2D impasto `<fc-painting>` engine (22 verified `<= 320px` reference portraits with CC BY/BY-SA attribution in `FcArt.astro` & `/about`, Wet-Oil & Archival Exhibit interactions, keyboard/screen-reader a11y), 22 primary-sourced launch stories, Pagefind `/ledger`, thermal Crime Receipt printer & PNG export, `/about`, `/corrections`, `/rss.xml`, sitemap, `og:image`, JSON-LD, build-time `sanitize-html`, Vitest test suite, Gemini `judge:slap` CLI, and hardened GitHub Actions CI.
2. **Phase 2 (Configured — Antigravity Daily 6:00 AM ET Automation):** Scheduled Antigravity Automation (`Financial Crimes — Daily Morning Sweep`, `CRON_TZ=America/New_York 0 6 * * *`, `gemini-4-neon-high`) handling research, drafting, 320px portrait sourcing, validation, tests, build, push to `main`, and live deployment.
3. **Phase 3 (Coming Soon — Email Sign-Up, Tip Intake & Live Operations):** Wire **Cloudflare Email Service (GA)** for automated morning digest delivery, Turnstile-protected tip/correction intake, regional RSS feeds, and weekly automated acquittal/correction watcher.
