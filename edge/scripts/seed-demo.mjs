// Fills an existing merchant account with demo data through the public API, so every dashboard
// feature has something to show: points program, customers from each acquisition source, purchases,
// redemptions, campaigns in three states, prize wins, reviews.
//
//   LOYALI_EMAIL=... LOYALI_PASSWORD=... node scripts/seed-demo.mjs
//
// LOYALI_URL defaults to the workers.dev deployment; point it at `wrangler dev` for a local run.
// Customer emails use example.com (reserved, never delivered) with a suffix, because the customers
// table is shared across merchants. Public routes are throttled at 10/min per IP, so those calls are
// paced. Program and campaigns are created once; a second run adds more purchases and reviews.

const BASE = `${process.env.LOYALI_URL || "https://loyali.dot-shopfully.workers.dev"}/api`;
const EMAIL = process.env.LOYALI_EMAIL;
const PASSWORD = process.env.LOYALI_PASSWORD;
const SUFFIX = process.env.LOYALI_EMAIL_SUFFIX || "loyalitest";
const PUBLIC_PAUSE_MS = Number(process.env.LOYALI_PUBLIC_PAUSE_MS ?? 6500);

if (!EMAIL || !PASSWORD) {
  console.error("Set LOYALI_EMAIL and LOYALI_PASSWORD");
  process.exit(1);
}

// Seeded PRNG (mulberry32) so two runs on empty accounts produce the same data.
let seed = 20261028;
function random() {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const pick = (list) => list[Math.floor(random() * list.length)];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let apiKey = null;

async function call(method, path, payload, auth = true) {
  const headers = { "Content-Type": "application/json", "User-Agent": "loyali-seed/1.0" };
  if (auth && apiKey) headers["X-API-Key"] = apiKey;
  const res = await fetch(BASE + path, {
    method,
    headers,
    body: payload === undefined ? undefined : JSON.stringify(payload),
  });
  const text = await res.text();
  if (!res.ok) {
    console.log(`  !! ${method} ${path} -> ${res.status} ${text.slice(0, 200)}`);
    return null;
  }
  return text ? JSON.parse(text) : {};
}

async function publicCall(method, path, payload) {
  const res = await call(method, path, payload, false);
  await sleep(PUBLIC_PAUSE_MS);
  return res;
}

const mail = (first, last) => `${first}.${last}.${SUFFIX}@example.com`.toLowerCase().replace(/[\s']/g, "");
const euro = (amount) => `€${amount.toFixed(2).replace(".", ",")}`;

const login = await call("POST", "/auth/login", { email: EMAIL, password: PASSWORD }, false);
if (!login) process.exit(1);
apiKey = login.apiKey;
const merchantId = login.merchant.id;
console.log("merchant", merchantId);

// 1. Merchant profile and review settings
await call("PATCH", "/merchants/me", {
  phone: "+39 02 0000 0000",
  address: "Via di Prova 1",
  city: "Milano",
  country: "IT",
  settings: JSON.stringify({
    reviewFlowEnabled: true,
    googleMapsUrl: "https://www.google.com/maps/search/?api=1&query=Piazza+del+Duomo+Milano",
  }),
});
console.log("1. profile updated");

// 2. Points program with four reward tiers
let program = await call("GET", "/programs/mine");
if (!program) {
  program = await call("POST", "/programs", {
    type: "POINTS",
    pointsPerCurrency: 1,
    welcomePoints: 5,
    rewardTiers: [
      { name: "Caffè", threshold: 10, rewardName: "Caffè gratis" },
      { name: "Colazione", threshold: 25, rewardName: "Cappuccino + cornetto" },
      { name: "Pranzo", threshold: 60, rewardName: "Pranzo per uno" },
      { name: "VIP", threshold: 120, rewardName: "Brunch per due" },
    ],
  });
  if (!program) process.exit(1);
}
console.log("2. program", program.type, program.rewardTiers.map((t) => t.threshold));

// 3. Customers added by the merchant (MERCHANT_MANUAL)
const manual = [
  ["Giulia", "Rossi", "+39 333 000 0001"], ["Marco", "Bianchi"], ["Francesca", "Russo", "+39 333 000 0003"],
  ["Luca", "Ferrari"], ["Sara", "Esposito", "+39 333 000 0005"], ["Alessandro", "Romano"],
  ["Chiara", "Colombo"], ["Matteo", "Ricci", "+39 333 000 0008"], ["Elena", "Marino"],
  ["Davide", "Greco"], ["Martina", "Bruno", "+39 333 000 0011"], ["Simone", "Gallo"],
  ["Valentina", "Conti"], ["Andrea", "De Luca", "+39 333 000 0014"], ["Federica", "Mancini"],
  ["Pino", "Costa", "+39 333 000 0016"],
];
const customers = [];
const cardLinks = [];
for (const [first, last, phone] of manual) {
  const payload = { firstName: first, lastName: last, email: mail(first, last), ...(phone ? { phone } : {}) };
  const res = await call("POST", "/customers/manual-add", payload);
  if (!res) continue;
  customers.push({ id: res.customer.id, first, email: payload.email });
  cardLinks.push([`${first} ${last}`, res.loyaltyUrl]);
}
console.log(`3. manual-add: ${customers.length} customers`);

// 4. Customers who joined from the public form (SELF_JOIN), with and without marketing consent
const joins = [["Laura", "Fontana", true], ["Paolo", "Rizzo", false], ["Silvia", "Lombardi", true], ["Giorgio", "Moretti", true]];
for (const [first, last, marketingConsent] of joins) {
  const res = await publicCall("POST", `/loyalty/${merchantId}/join`, {
    firstName: first, lastName: last, email: mail(first, last), marketingConsent,
  });
  if (res) cardLinks.push([`${first} ${last} (self-join)`, res.loyaltyUrl]);
}
const listing = (await call("GET", "/customers?limit=100")) ?? { data: [] };
const byEmail = new Map(listing.data.map((row) => [row.email, row]));
for (const [first, last] of joins) {
  const row = byEmail.get(mail(first, last));
  if (row) customers.push({ id: row.customerId, first, email: mail(first, last) });
}
console.log(`4. self-join done, ${customers.length} customers in total`);

// 5. Purchases: 1-7 point earns per customer, three regulars with 9
const spends = ["Colazione", "Caffè e brioche", "Pranzo", "Aperitivo", "Spesa al banco", "Torta da asporto", "Merenda"];
let earns = 0;
for (const [i, customer] of customers.entries()) {
  const visits = [0, 7, 15].includes(i) ? 9 : pick([1, 2, 3, 4, 5, 7]);
  for (let v = 0; v < visits; v++) {
    const amount = Math.round((2.5 + random() * 25.5) * 100) / 100;
    const res = await call("POST", `/customers/${customer.id}/points`, {
      points: Math.max(1, Math.floor(amount)),
      description: `${pick(spends)} ${euro(amount)}`,
    });
    if (res) earns++;
  }
}
console.log(`5. earn transactions: ${earns}`);

// 6. Reward redemptions on the customers who can afford them
let redeemed = 0;
for (const customer of customers) {
  const rewards = await call("GET", `/customers/${customer.id}/available-rewards`);
  if (!rewards?.availableRewards.length || random() < 0.4) continue;
  const tier = pick(rewards.availableRewards);
  if (await call("POST", `/customers/${customer.id}/redeem`, { rewardTierId: tier.id })) redeemed++;
}
console.log(`6. redemptions: ${redeemed}`);

// 7. Campaigns: one live spin wheel, one scheduled scratch card, one ended and switched off
const existing = (await call("GET", "/campaigns")) ?? [];
let wheel = existing.find((c) => c.gameType === "SPIN_WHEEL") ?? existing[0];
if (!existing.length) {
  wheel = await call("POST", "/campaigns", {
    name: "Ruota d'autunno",
    description: "Gira la ruota e vinci un premio",
    gameType: "SPIN_WHEEL",
    prizes: [
      { name: "Caffè gratis", prizeType: "PHYSICAL", probability: 40, validityDays: 14 },
      { name: "Sconto 10%", prizeType: "DIGITAL", prizeValue: "10%", probability: 30, validityDays: 30 },
      { name: "Cornetto gratis", prizeType: "PHYSICAL", probability: 20, validityDays: 14 },
      { name: "Brunch per due", prizeType: "PHYSICAL", probability: 10, validityDays: 30 },
    ],
  });
  await call("POST", "/campaigns", {
    name: "Gratta e vinci di Natale",
    gameType: "SCRATCH_CARD",
    startDate: "2026-12-01T00:00:00Z",
    endDate: "2026-12-31T23:59:59Z",
    prizes: [
      { name: "Panettone", prizeType: "PHYSICAL", probability: 10 },
      { name: "Cioccolata calda", prizeType: "PHYSICAL", probability: 50 },
      { name: "Sconto 5%", prizeType: "DIGITAL", prizeValue: "5%", probability: 40 },
    ],
  });
  const summer = await call("POST", "/campaigns", {
    name: "Estate 2026",
    gameType: "SCRATCH_CARD",
    startDate: "2026-06-01T00:00:00Z",
    endDate: "2026-08-31T23:59:59Z",
    prizes: [{ name: "Granita gratis", prizeType: "PHYSICAL", probability: 100 }],
  });
  if (summer) await call("PATCH", `/campaigns/${summer.id}`, { active: false });
}
console.log("7. campaigns ready, live:", wheel?.name);

// 8. Plays and claims on the live wheel: three enrolled customers, three new players
const players = [
  ...customers.slice(0, 3).map((c) => [c.first, "", c.email]),
  ["Irene", "Barbieri", mail("Irene", "Barbieri")],
  ["Tommaso", "Pellegrini", mail("Tommaso", "Pellegrini")],
  ["Noemi", "Caruso", mail("Noemi", "Caruso")],
];
const wins = [];
for (const [first, last, email] of players) {
  const drawn = await publicCall("POST", `/gamification/${merchantId}/play`, { email });
  if (!drawn) continue;
  const win = await publicCall("POST", `/gamification/${merchantId}/claim`, {
    prizeId: drawn.prizeId, email, firstName: first, ...(last ? { lastName: last } : {}),
  });
  if (win) wins.push({ first, prize: drawn.prizeName, code: win.redemptionCode });
}
console.log(`8. prize wins: ${wins.length}`);

// 9. Two prizes redeemed at the counter, the others stay pending
for (const win of wins.slice(0, 2)) {
  await call("POST", `/campaigns/${wheel.id}/redeem`, { redemptionCode: win.code });
}
console.log("9. redeemed at counter:", wins.slice(0, 2).map((w) => `${w.first}: ${w.prize}`));

// 10. Reviews: spread of ratings, some linked to a customer, three 5-star redirects to Google
const reviews = [
  [5, "Il miglior cappuccino della zona, personale gentilissimo.", [5, 5, 5], customers[0]],
  [5, "Cornetti sempre freschi, la tessera è comodissima.", [5, 5, 4], customers[2]],
  [4, "Buono il pranzo, un po' di attesa all'ora di punta.", [4, 3, 4], customers[4]],
  [4],
  [3, "Caffè buono ma i tavoli erano sporchi.", [4, 3, 2], customers[6]],
  [2, "Ho aspettato 20 minuti per un panino.", [3, 1, 3]],
  [5, "Ambiente accogliente, ci torno ogni mattina.", [5, 5, 5], customers[8]],
  [1, "Mi hanno sbagliato l'ordine due volte.", [2, 1, 2]],
  [4, "Ottimo aperitivo, prezzi giusti.", [4, 4, 5], customers[10]],
  [5, "Brunch fantastico."],
];
let sent = 0;
for (const [rating, text, detail, customer] of reviews) {
  const payload = { rating };
  if (text) payload.text = text;
  if (detail) Object.assign(payload, { foodRating: detail[0], serviceRating: detail[1], atmosphereRating: detail[2] });
  if (customer) Object.assign(payload, { email: customer.email, firstName: customer.first });
  if (await publicCall("POST", `/feedback/${merchantId}`, payload)) sent++;
}
for (const customer of [customers[0], customers[8], undefined]) {
  await publicCall("POST", `/feedback/${merchantId}/google-redirect`, customer ? { email: customer.email } : {});
}
console.log(`10. reviews: ${sent}, google redirects: 3`);

console.log("STATS", JSON.stringify(await call("GET", "/stats")));
console.log("CARD LINKS");
for (const [name, url] of cardLinks.slice(0, 3)) console.log(" ", name, url);
console.log("PENDING PRIZE CODES", wins.slice(2).map((w) => `${w.first}: ${w.prize} ${w.code}`));
