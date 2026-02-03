import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnv() {
  const envPath = resolve(process.cwd(), ".env");
  const content = readFileSync(envPath, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    value = value.replace(/^"(.*)"$/, "$1");
    if (!process.env[key]) process.env[key] = value;
  }
}

function toSubmission({
  id,
  name,
  type,
  coordinates,
  price,
  fuelType,
  quality,
  availability,
  queueLength,
  provider,
  merchantId,
  reliability,
  hours,
  paymentMethods,
}) {
  const now = new Date().toISOString();
  const isFuel = type === "FUEL";
  return {
    id: crypto.randomUUID(),
    userId: "seed",
    category: isFuel ? "fuel_station" : "mobile_money",
    location: coordinates,
    details: {
      siteName: name,
      price: typeof price === "number" ? price : undefined,
      fuelPrice: typeof price === "number" ? price : undefined,
      fuelType,
      quality,
      availability,
      queueLength,
      provider,
      merchantId,
      reliability,
      hours,
      paymentModes: paymentMethods,
    },
    createdAt: now,
  };
}

async function main() {
  loadEnv();
  const configId = process.env.EDGE_CONFIG_ID;
  const token = process.env.VERCEL_API_TOKEN;
  if (!configId || !token) {
    console.error("Missing EDGE_CONFIG_ID or VERCEL_API_TOKEN in .env");
    process.exit(1);
  }

  const mockPoints = [
    {
      id: "1",
      name: "Total Akwa",
      type: "FUEL",
      coordinates: { latitude: 4.0516, longitude: 9.7072 },
      price: 840,
      fuelType: "Super",
      quality: "Premium",
      availability: "High",
      queueLength: "Short",
      hours: "Open 24 Hours • Daily",
      paymentMethods: ["Cash", "MTN MoMo", "Orange Money", "Cards"],
    },
    {
      id: "2",
      name: "Tradex Gare des Grands Bus",
      type: "FUEL",
      coordinates: { latitude: 4.0582, longitude: 9.7136 },
      price: 828,
      fuelType: "Diesel",
      quality: "Standard",
      availability: "High",
      queueLength: "Moderate",
      hours: "Open 24 Hours • Daily",
      paymentMethods: ["Cash", "Mobile Money"],
    },
    {
      id: "3",
      name: "Oryx Bonamoussadi",
      type: "FUEL",
      coordinates: { latitude: 4.0831, longitude: 9.7446 },
      price: 845,
      fuelType: "Super",
      quality: "Premium",
      availability: "High",
      queueLength: "Short",
      hours: "06:00 - 22:00",
      paymentMethods: ["Cash", "Cards"],
    },
    {
      id: "4",
      name: "Total Deido",
      type: "FUEL",
      coordinates: { latitude: 4.0609, longitude: 9.7341 },
      price: 832,
      fuelType: "Super",
      quality: "Standard",
      availability: "High",
      queueLength: "Long",
      hours: "Open 24 Hours • Daily",
      paymentMethods: ["Cash", "Orange Money"],
    },
    {
      id: "5",
      name: "Afriquia Logpom",
      type: "FUEL",
      coordinates: { latitude: 4.0148, longitude: 9.7603 },
      price: 820,
      fuelType: "Gaz",
      quality: "Low",
      availability: "Low",
      queueLength: "Moderate",
      hours: "07:00 - 21:00",
      paymentMethods: ["Cash", "Mobile Money"],
    },
    {
      id: "6",
      name: "MTN Mobile Money - Bonapriso",
      type: "MOBILE_MONEY",
      coordinates: { latitude: 4.0345, longitude: 9.7003 },
      availability: "Available",
      queueLength: "Moderate",
      provider: "MTN",
      merchantId: "M-129384",
      reliability: "Excellent",
    },
    {
      id: "7",
      name: "Orange Money Kiosk - Deido",
      type: "MOBILE_MONEY",
      coordinates: { latitude: 4.0735, longitude: 9.7321 },
      availability: "Limited",
      queueLength: "Long",
      provider: "Orange",
      merchantId: "O-99231",
      reliability: "Congested",
    },
    {
      id: "8",
      name: "Airtel Money Kiosk - Akwa",
      type: "MOBILE_MONEY",
      coordinates: { latitude: 4.0502, longitude: 9.7084 },
      availability: "Available",
      queueLength: "Short",
      provider: "Airtel",
      merchantId: "A-88102",
      reliability: "Good",
    },
    {
      id: "9",
      name: "MTN Express Kiosk - Bonamoussadi",
      type: "MOBILE_MONEY",
      coordinates: { latitude: 4.0864, longitude: 9.7402 },
      availability: "Available",
      queueLength: "Short",
      provider: "MTN",
      merchantId: "M-44511",
      reliability: "Excellent",
    },
    {
      id: "10",
      name: "Orange Money Kiosk - Logpom",
      type: "MOBILE_MONEY",
      coordinates: { latitude: 4.0189, longitude: 9.7574 },
      availability: "Out",
      queueLength: "Long",
      provider: "Orange",
      merchantId: "O-33210",
      reliability: "Poor",
    },
  ];

  const submissions = mockPoints.map(toSubmission);
  const res = await fetch(`https://api.vercel.com/v1/edge-config/${configId}/items`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      items: [{ operation: "upsert", key: "submissions", value: submissions }],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`Failed to seed submissions: ${res.status} ${text}`);
    process.exit(1);
  }

  console.log(`Seeded ${submissions.length} submissions into Edge Config.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
