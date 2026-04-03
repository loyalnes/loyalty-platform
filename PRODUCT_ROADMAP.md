# Loyalty Platform - Product Roadmap

## Vision
Semplificare la gestione di programmi fedeltà per gli esercenti, rendendo ogni interazione intuitiva e immediata.

---

## Epic 1: Core Navigation & Home Redesign
**Goal:** Creare una struttura di navigazione chiara con 4 tab e una home ottimizzata per azioni rapide.

### User Stories

#### US-1.1: Bottom Navigation
**Come** esercente  
**Voglio** una barra di navigazione sempre visibile con 4 sezioni principali  
**Così che** possa accedere rapidamente a tutte le funzionalità

**Acceptance Criteria:**
- [ ] Bottom nav fissa con 4 tab: Today, Insights, Customers, Menu
- [ ] Icone chiare e riconoscibili per ogni tab
- [ ] Tab attivo evidenziato visivamente
- [ ] Transizioni fluide tra le tab
- [ ] Persistenza della tab attiva al reload

**Priority:** P0 (Must Have)  
**Effort:** 3 punti

---

#### US-1.2: Quick Actions sulla Home
**Come** esercente  
**Voglio** 4 azioni rapide sempre visibili nella home  
**Così che** possa completare le operazioni più frequenti con un solo tap

**Acceptance Criteria:**
- [ ] 4 bottoni grandi e ben spaziati: Scan QR, Redeem, Show QR, Contest
- [ ] Icone intuitive per ogni azione
- [ ] Feedback visivo al tap (haptic + animazione)
- [ ] Bottoni disabilitati se prerequisiti non soddisfatti (es: Redeem senza programma)

**Priority:** P0 (Must Have)  
**Effort:** 5 punti

---

#### US-1.3: Program Card Minimal
**Come** esercente  
**Voglio** vedere le info essenziali del mio programma fedeltà in un colpo d'occhio  
**Così che** possa verificare configurazione e membri attivi

**Acceptance Criteria:**
- [ ] Card compatta con: nome programma, tipo (punti/stamp), goal, membri attivi
- [ ] Bottone "Edit" visibile solo se 0 membri iscritti
- [ ] Link a dettaglio completo in Menu → Loyalty Settings
- [ ] Stato vuoto se nessun programma configurato con CTA "Setup Program"

**Priority:** P0 (Must Have)  
**Effort:** 3 punti

---

#### US-1.4: Quick Stats sulla Home
**Come** esercente  
**Voglio** vedere 2-3 metriche chiave direttamente nella home  
**Così che** possa monitorare la salute del business a colpo d'occhio

**Acceptance Criteria:**
- [ ] Mostra nuovi membri oggi/questa settimana con trend
- [ ] Mostra numero clienti vicini al reward
- [ ] Visual badge/indicator per attirare attenzione
- [ ] Tap sulla stat → navigazione a Insights tab

**Priority:** P1 (Should Have)  
**Effort:** 3 punti

---

## Epic 2: Insights & Feedback Unificati
**Goal:** Fornire all'esercente una visione completa della salute del business e del sentiment dei clienti.

### User Stories

#### US-2.1: KPI Dashboard con Filtri Temporali
**Come** esercente  
**Voglio** visualizzare le metriche chiave del mio business con filtri temporali  
**Così che** possa analizzare trend e performance

**Acceptance Criteria:**
- [ ] Filtri rapidi: 24h, 7d, 15d, 30d
- [ ] KPI cards: Active members, New members, Avg Rating, Retention
- [ ] Ogni card mostra trend vs periodo precedente (↗↘)
- [ ] Animazioni al cambio periodo
- [ ] Loading state durante fetch dati

**Priority:** P0 (Must Have)  
**Effort:** 8 punti

---

#### US-2.2: Sentiment Analysis
**Come** esercente  
**Voglio** vedere il sentiment medio dei clienti con distribuzione per stelle  
**Così che** possa capire come i clienti percepiscono il mio servizio

**Acceptance Criteria:**
- [ ] Score medio da 1 a 5 stelle
- [ ] Grafico a barre con distribuzione (quanti 5★, 4★, etc.)
- [ ] Filtro temporale applicabile
- [ ] Empty state se nessun feedback raccolto

**Priority:** P1 (Should Have)  
**Effort:** 5 punti

---

#### US-2.3: Feedback List con Priorità
**Come** esercente  
**Voglio** leggere i feedback lasciati dai clienti con evidenza per quelli negativi  
**Così che** possa rispondere prontamente e migliorare il servizio

**Acceptance Criteria:**
- [ ] Lista ordinata per data (più recenti prima)
- [ ] Feedback negativi (<3 stelle) evidenziati con colore/icona
- [ ] Preview testo feedback (max 2 righe) + expand
- [ ] Mostra: rating, nome cliente, data, testo
- [ ] Bottone "View all" se più di 3 feedback
- [ ] Badge "new" su feedback non letti

**Priority:** P0 (Must Have)  
**Effort:** 5 punti

---

#### US-2.4: Notifiche e Promemoria Operativi
**Come** esercente  
**Voglio** ricevere notifiche smart sulle azioni da fare  
**Così che** non mi sfugga nessuna opportunità o problema

**Acceptance Criteria:**
- [ ] Alert visibile in cima alla tab Insights
- [ ] Notifiche: clienti che hanno raggiunto tier, clienti inattivi >30gg, possibili reward
- [ ] Max 3 notifiche visibili, poi "View all"
- [ ] Dismissable individualmente
- [ ] Tap su notifica → azione suggerita (es: vai a customer detail)

**Priority:** P1 (Should Have)  
**Effort:** 5 punti

---

## Epic 3: Customer Management
**Goal:** Dare all'esercente strumenti potenti per conoscere e gestire i propri clienti.

### User Stories

#### US-3.1: Customer List con Search
**Come** esercente  
**Voglio** vedere l'elenco dei miei clienti e cercarli per nome/telefono  
**Così che** possa trovare rapidamente un cliente specifico

**Acceptance Criteria:**
- [ ] Search bar in cima sempre visibile
- [ ] Ricerca real-time (debounced) su nome, cognome, email, telefono
- [ ] Lista mostra: nome, contatto principale, punti, ultima visita
- [ ] Avatar con iniziali se no foto
- [ ] Empty state se nessun cliente
- [ ] Pull-to-refresh per aggiornare lista

**Priority:** P0 (Must Have)  
**Effort:** 5 punti

---

#### US-3.2: Customer Filters
**Come** esercente  
**Voglio** filtrare i clienti per segmenti (VIP, At Risk, New)  
**Così che** possa focalizzarmi su gruppi specifici

**Acceptance Criteria:**
- [ ] Filtri quick: All, VIP (top 20% spenders), At Risk (>30gg inattivi), New (<7gg)
- [ ] Chip selezionabili sotto la search bar
- [ ] Counter per ogni filtro
- [ ] Filtri persistenti durante la sessione
- [ ] Combinabili con search

**Priority:** P1 (Should Have)  
**Effort:** 3 punti

---

#### US-3.3: Customer Detail
**Come** esercente  
**Voglio** vedere il profilo completo di un cliente con storico visite  
**Così che** possa capire le sue abitudini e fidelizzazione

**Acceptance Criteria:**
- [ ] Header con: nome, contatti, avatar
- [ ] Riepilogo: punti attuali, punti spesi, data iscrizione, frequenza visite
- [ ] Timeline delle visite (data + azione + punti)
- [ ] Indicatore "Near reward" se vicino a tier
- [ ] Bottone back per tornare alla lista
- [ ] (Future) Pulsante "Send message"

**Priority:** P1 (Should Have)  
**Effort:** 8 punti

---

#### US-3.4: Customer Stats
**Como** esercente  
**Voglio** vedere statistiche aggregate sui miei clienti  
**Così che** possa capire i pattern comportamentali

**Acceptance Criteria:**
- [ ] Mostra: totale clienti, nuovi questa settimana, retention rate
- [ ] Distribuzione per frequenza (1x/settimana, 1x/mese, etc.)
- [ ] Top 5 clienti per punti
- [ ] Grafici semplici e immediati

**Priority:** P2 (Nice to Have)  
**Effort:** 5 punti

---

## Epic 4: Scan & Reward Actions
**Goal:** Rendere l'aggiunta/scarico punti e la consegna premi un'esperienza fluida e veloce.

### User Stories

#### US-4.1: Scan QR Code Flow
**Come** esercente  
**Voglio** scansionare il QR del cliente per vedere il suo profilo e aggiungere/scaricare punti  
**Così che** possa completare l'operazione in pochi secondi

**Acceptance Criteria:**
- [ ] Camera scan con frame guida
- [ ] Riconoscimento automatico QR cliente
- [ ] Mostra: nome, punti attuali, stato tier
- [ ] Quick actions: +5, +10, +custom punti
- [ ] Pulsante "Redeem reward" se disponibile
- [ ] Feedback success con animazione
- [ ] Fallback manual input se camera non disponibile

**Priority:** P0 (Must Have)  
**Effort:** 13 punti

---

#### US-4.2: Manual Points Add/Remove
**Come** esercente  
**Voglio** aggiungere o rimuovere punti manualmente da customer detail  
**Così che** possa gestire casi particolari (errori, premi extra, etc.)

**Acceptance Criteria:**
- [ ] Input numerico per punti
- [ ] Toggle add/remove
- [ ] Campo note opzionale
- [ ] Conferma prima di applicare
- [ ] Aggiornamento real-time del saldo
- [ ] Toast di conferma

**Priority:** P1 (Should Have)  
**Effort:** 5 punti

---

#### US-4.3: Redeem Reward Flow
**Come** esercente  
**Voglio** consegnare un premio a un cliente quando raggiunge il tier  
**Così che** il cliente possa riscattare i suoi punti

**Acceptance Criteria:**
- [ ] Mostra premi disponibili per il cliente (tier raggiunti)
- [ ] Selezione premio da lista
- [ ] Conferma consegna con recap punti scalati
- [ ] Celebrazione visiva (confetti) al redeem
- [ ] Aggiornamento immediato del saldo cliente
- [ ] Storico redeem visibile in customer detail

**Priority:** P0 (Must Have)  
**Effort:** 8 punti

---

#### US-4.4: Show QR for Signup
**Come** esercente  
**Voglio** mostrare un QR code ai nuovi clienti per iscriverli al programma  
**Così che** possano registrarsi rapidamente

**Acceptance Criteria:**
- [ ] QR code full-screen con logo/brand
- [ ] Tap per copiare link di iscrizione
- [ ] Condivisione via WhatsApp/SMS
- [ ] Darkmode aware (QR sempre leggibile)
- [ ] Refresh QR se necessario

**Priority:** P0 (Must Have)  
**Effort:** 3 punti

---

## Epic 5: Gamification & Contests
**Goal:** Permettere all'esercente di creare engagement extra con contest e giochi.

### User Stories

#### US-5.1: Contest Creation
**Come** esercente  
**Voglio** creare un contest "vinci un premio" per i miei clienti  
**Così che** possa aumentare engagement e visite

**Acceptance Criteria:**
- [ ] Form creazione: nome contest, premio, durata, regole
- [ ] Opzioni: spin wheel, scratch card, instant win
- [ ] Possibilità di limitare a X tentativi per cliente
- [ ] Preview contest prima di pubblicare
- [ ] Attivazione/disattivazione contest

**Priority:** P2 (Nice to Have)  
**Effort:** 13 punti

---

#### US-5.2: Contest Invite
**Come** esercente  
**Voglio** invitare clienti a partecipare al contest attivo  
**Così che** possano giocare e vincere premi

**Acceptance Criteria:**
- [ ] Pulsante "Invite to contest" nella home
- [ ] Mostra QR/link contest
- [ ] Counter partecipazioni in tempo reale
- [ ] Notifica quando qualcuno vince

**Priority:** P2 (Nice to Have)  
**Effort:** 5 punts

---

## Epic 6: Menu & Settings
**Goal:** Fornire accesso a configurazioni, profilo business e impostazioni account.

### User Stories

#### US-6.1: Business Profile
**Como** esercente  
**Voglio** gestire le info del mio business (nome, indirizzo, orari)  
**Così che** i clienti vedano info corrette

**Acceptance Criteria:**
- [ ] Form modifica: nome, indirizzo, città, telefono, email
- [ ] Upload logo/foto negozio
- [ ] Orari apertura (opzionale)
- [ ] Salvataggio con validazione
- [ ] Preview come appare ai clienti

**Priority:** P1 (Should Have)  
**Effort:** 5 punti

---

#### US-6.2: Loyalty Program Settings
**Como** esercente  
**Voglio** modificare le regole del mio programma fedeltà  
**Così che** possa adattarlo nel tempo

**Acceptance Criteria:**
- [ ] Modifica parametri: punti per euro, goal stamp, tier, premi
- [ ] Warning se ci sono già clienti iscritti
- [ ] Possibilità di eliminare programma se 0 clienti
- [ ] Conferma prima di salvare modifiche importanti
- [ ] Cronologia modifiche (audit log)

**Priority:** P1 (Should Have)  
**Effort:** 8 punti

---

#### US-6.3: Account Settings
**Como** esercente  
**Voglio** gestire preferenze account (lingua, notifiche)  
**Così che** possa personalizzare la mia esperienza

**Acceptance Criteria:**
- [ ] Cambio lingua (en, it, es)
- [ ] Toggle notifiche push
- [ ] Toggle notifiche email
- [ ] Cambio password
- [ ] Sign out

**Priority:** P1 (Should Have)  
**Effort:** 3 punti

---

## Priority Matrix

### Sprint 1 (2 weeks) - MVP Core
- US-1.1: Bottom Navigation (P0)
- US-1.2: Quick Actions (P0)
- US-1.3: Program Card (P0)
- US-4.4: Show QR Signup (P0)

**Total:** 14 punti

### Sprint 2 (2 weeks) - Insights Base
- US-2.1: KPI Dashboard (P0)
- US-2.3: Feedback List (P0)
- US-1.4: Quick Stats (P1)

**Total:** 16 punti

### Sprint 3 (2 weeks) - Customer Management
- US-3.1: Customer List with Search (P0)
- US-4.1: Scan QR Flow (P0)

**Total:** 18 punti

### Sprint 4 (2 weeks) - Actions & Detail
- US-4.3: Redeem Reward Flow (P0)
- US-3.3: Customer Detail (P1)
- US-2.2: Sentiment Analysis (P1)

**Total:** 18 punti

### Sprint 5 (2 weeks) - Polish & Settings
- US-2.4: Notifiche Operativi (P1)
- US-3.2: Customer Filters (P1)
- US-4.2: Manual Points (P1)
- US-6.1: Business Profile (P1)

**Total:** 18 punti

### Sprint 6 (2 weeks) - Advanced Features
- US-6.2: Loyalty Settings (P1)
- US-6.3: Account Settings (P1)
- US-3.4: Customer Stats (P2)

**Total:** 16 punti

### Backlog / Future
- US-5.1: Contest Creation (P2)
- US-5.2: Contest Invite (P2)
- Export CSV
- Customer Communication
- Integrations

---

## Success Metrics

### North Star Metric
**Daily Active Merchants** - Numero di esercenti che usano l'app ogni giorno

### Key Metrics
- **Time to Complete Action** - Tempo medio per scan → add points (target: <10 sec)
- **Actions per Day per Merchant** - Numero medio operazioni giornaliere (target: >15)
- **Customer Enrollment Rate** - % clienti che si iscrivono al programma (target: >60%)
- **Merchant Retention (D7, D30)** - % esercenti attivi dopo 7/30 giorni

### Feature Adoption
- % esercenti che usano Scan QR (target: >95%)
- % esercenti che controllano Insights settimanalmente (target: >70%)
- % esercenti con almeno 1 feedback risposto (target: >50%)

---

## Technical Notes

### State Management
- React Context per auth e program
- Local state per UI temporanei
- React Query per data fetching e cache

### Mobile Optimization
- Bottom nav sticky
- Touch targets min 44x44px
- Swipe gestures dove appropriato
- Haptic feedback su azioni critiche

### Performance
- Lazy load delle tab non attive
- Virtualized lists per customer list >100 items
- Image optimization (WebP, lazy load)
- Service worker per offline basic functions

### Accessibility
- Contrast ratio WCAG AA minimum
- Screen reader support
- Keyboard navigation
- Error messages chiari e actionable
