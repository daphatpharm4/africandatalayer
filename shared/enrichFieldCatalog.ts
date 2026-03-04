export type EnrichFieldKind = "boolean" | "text" | "number" | "single_select" | "multi_select" | "map_value";

export interface EnrichFieldOption {
  value: string;
  labelEn: string;
  labelFr: string;
}

export interface EnrichFieldConfig {
  labelEn: string;
  labelFr: string;
  kind: EnrichFieldKind;
  options?: readonly EnrichFieldOption[];
  placeholderEn?: string;
  placeholderFr?: string;
}

function option(value: string, labelEn: string, labelFr = labelEn): EnrichFieldOption {
  return { value, labelEn, labelFr };
}

export const ENRICH_FIELD_CATALOG: Record<string, EnrichFieldConfig> = {
  openingHours: {
    labelEn: "Opening Hours",
    labelFr: "Heures d'ouverture",
    kind: "text",
    placeholderEn: "e.g. 08:00 - 20:00",
    placeholderFr: "ex. 08:00 - 20:00",
  },
  isOpenNow: { labelEn: "Open Now", labelFr: "Ouvert maintenant", kind: "boolean" },
  isOnDuty: { labelEn: "On-call Pharmacy", labelFr: "Pharmacie de garde", kind: "boolean" },
  isLicensed: { labelEn: "Licensed", labelFr: "Avec licence", kind: "boolean" },
  hasPrescriptionService: { labelEn: "Prescription Service", labelFr: "Service ordonnance", kind: "boolean" },
  medicineCategories: {
    labelEn: "Medicine Categories",
    labelFr: "Categories de medicaments",
    kind: "multi_select",
    options: [
      option("antibiotics", "Antibiotics", "Antibiotiques"),
      option("pain_relief", "Pain Relief", "Antidouleur"),
      option("vitamins", "Vitamins", "Vitamines"),
      option("baby_care", "Baby Care", "Soins bebe"),
      option("first_aid", "First Aid", "Premiers soins"),
      option("chronic_disease", "Chronic Disease", "Maladies chroniques"),
    ],
  },

  merchantIdByProvider: { labelEn: "Merchant IDs", labelFr: "ID marchands", kind: "map_value" },
  paymentMethods: {
    labelEn: "Payment Methods",
    labelFr: "Moyens de paiement",
    kind: "multi_select",
    options: [
      option("Cash", "Cash", "Cash"),
      option("Mobile Money", "Mobile Money", "Mobile Money"),
      option("Card", "Card", "Carte"),
    ],
  },
  providers: {
    labelEn: "Providers",
    labelFr: "Operateurs",
    kind: "multi_select",
    options: [option("MTN"), option("Orange"), option("Airtel")],
  },
  isActive: { labelEn: "Agent Active", labelFr: "Agent actif", kind: "boolean" },
  hasFloat: { labelEn: "Has Float", labelFr: "A de la liquidite", kind: "boolean" },
  agentType: {
    labelEn: "Agent Type",
    labelFr: "Type d'agent",
    kind: "single_select",
    options: [
      option("kiosk", "Kiosk", "Kiosque"),
      option("shop", "Shop", "Boutique"),
      option("individual", "Individual", "Individuel"),
      option("super_agent", "Super Agent", "Super agent"),
      option("other", "Other", "Autre"),
    ],
  },

  fuelTypes: {
    labelEn: "Fuel Types",
    labelFr: "Types de carburant",
    kind: "multi_select",
    options: [option("Super"), option("Diesel"), option("Gas")],
  },
  pricesByFuel: { labelEn: "Fuel Prices", labelFr: "Prix carburant", kind: "map_value" },
  quality: {
    labelEn: "Quality",
    labelFr: "Qualite",
    kind: "single_select",
    options: [option("Premium"), option("Standard"), option("Low", "Low", "Faible")],
  },
  hasFuelAvailable: { labelEn: "Fuel Available", labelFr: "Carburant disponible", kind: "boolean" },
  queueLength: {
    labelEn: "Queue Length",
    labelFr: "Longueur de file",
    kind: "single_select",
    options: [
      option("none", "None", "Aucune"),
      option("short", "Short", "Courte"),
      option("medium", "Medium", "Moyenne"),
      option("long", "Long", "Longue"),
    ],
  },
  hasConvenienceStore: { labelEn: "Convenience Store", labelFr: "Suprette", kind: "boolean" },
  hasCarWash: { labelEn: "Car Wash", labelFr: "Lavage auto", kind: "boolean" },
  hasATM: { labelEn: "ATM", labelFr: "GAB", kind: "boolean" },

  brand: {
    labelEn: "Brand",
    labelFr: "Marque",
    kind: "text",
    placeholderEn: "Enter brand",
    placeholderFr: "Entrer la marque",
  },
  outletType: {
    labelEn: "Outlet Type",
    labelFr: "Type de point de vente",
    kind: "single_select",
    options: [
      option("bar", "Bar", "Bar"),
      option("restaurant", "Restaurant", "Restaurant"),
      option("off_licence", "Off Licence", "Cave"),
      option("street_vendor", "Street Vendor", "Vendeur de rue"),
      option("nightclub", "Nightclub", "Boite de nuit"),
    ],
  },
  isFormal: { labelEn: "Formal / Licensed", labelFr: "Formel / licence", kind: "boolean" },
  servesFood: { labelEn: "Serves Food", labelFr: "Sert des repas", kind: "boolean" },
  brandsAvailable: {
    labelEn: "Brands Available",
    labelFr: "Marques disponibles",
    kind: "multi_select",
    placeholderEn: "Comma-separated brands",
    placeholderFr: "Marques separees par des virgules",
  },
  priceRange: {
    labelEn: "Price Range",
    labelFr: "Niveau de prix",
    kind: "single_select",
    options: [
      option("budget", "Budget", "Economique"),
      option("mid", "Mid-range", "Moyen"),
      option("premium", "Premium", "Premium"),
      option("luxury", "Luxury", "Luxe"),
    ],
  },

  billboardType: {
    labelEn: "Billboard Type",
    labelFr: "Type de panneau",
    kind: "single_select",
    options: [
      option("standard", "Standard", "Standard"),
      option("digital", "Digital", "Numerique"),
      option("street_furniture", "Street Furniture", "Mobilier urbain"),
      option("wall_paint", "Wall Paint", "Peinture murale"),
      option("poster", "Poster", "Affiche"),
      option("informal", "Informal", "Informel"),
    ],
  },
  isOccupied: { labelEn: "Occupied", labelFr: "Occupe", kind: "boolean" },
  advertiserBrand: {
    labelEn: "Advertiser Brand",
    labelFr: "Marque annonceur",
    kind: "text",
    placeholderEn: "Enter advertiser brand",
    placeholderFr: "Entrer la marque annonceur",
  },
  advertiserCategory: {
    labelEn: "Advertiser Category",
    labelFr: "Categorie annonceur",
    kind: "text",
    placeholderEn: "Enter advertiser category",
    placeholderFr: "Entrer la categorie annonceur",
  },
  condition: {
    labelEn: "Condition",
    labelFr: "Etat",
    kind: "single_select",
    options: [
      option("excellent", "Excellent", "Excellent"),
      option("good", "Good", "Bon"),
      option("fair", "Fair", "Moyen"),
      option("poor", "Poor", "Mauvais"),
    ],
  },
  size: {
    labelEn: "Size",
    labelFr: "Taille",
    kind: "text",
    placeholderEn: "e.g. 4m x 3m",
    placeholderFr: "ex. 4m x 3m",
  },
  isLit: { labelEn: "Lit at Night", labelFr: "Eclaire la nuit", kind: "boolean" },

  isBlocked: { labelEn: "Blocked", labelFr: "Bloque", kind: "boolean" },
  blockageType: {
    labelEn: "Blockage Type",
    labelFr: "Type de blocage",
    kind: "single_select",
    options: [
      option("flooding", "Flooding", "Inondation"),
      option("construction", "Construction", "Travaux"),
      option("accident", "Accident", "Accident"),
      option("debris", "Debris", "Debris"),
      option("market_encroachment", "Market Encroachment", "Empietement de marche"),
    ],
  },
  surfaceType: {
    labelEn: "Surface Type",
    labelFr: "Type de surface",
    kind: "single_select",
    options: [
      option("asphalt", "Asphalt", "Asphalte"),
      option("laterite", "Laterite", "Laterite"),
      option("gravel", "Gravel", "Gravier"),
      option("earth", "Earth", "Terre"),
      option("concrete", "Concrete", "Beton"),
    ],
  },
  passableBy: {
    labelEn: "Passable By",
    labelFr: "Accessible par",
    kind: "multi_select",
    options: [
      option("pedestrian", "Pedestrian", "Pieton"),
      option("motorbike", "Motorbike", "Moto"),
      option("car", "Car", "Voiture"),
      option("bus", "Bus", "Bus"),
      option("truck", "Truck", "Camion"),
    ],
  },
  trafficLevel: {
    labelEn: "Traffic Level",
    labelFr: "Niveau de trafic",
    kind: "single_select",
    options: [
      option("low", "Low", "Faible"),
      option("medium", "Medium", "Moyen"),
      option("high", "High", "Eleve"),
    ],
  },
  hasStreetLight: { labelEn: "Street Light", labelFr: "Eclairage public", kind: "boolean" },

  occupancyStatus: {
    labelEn: "Occupancy Status",
    labelFr: "Statut d'occupation",
    kind: "single_select",
    options: [
      option("occupied", "Occupied", "Occupe"),
      option("partially_occupied", "Partially Occupied", "Partiellement occupe"),
      option("vacant", "Vacant", "Vacant"),
      option("under_construction", "Under Construction", "En construction"),
    ],
  },
  storeyCount: { labelEn: "Storey Count", labelFr: "Nombre d'etages", kind: "number" },
  estimatedUnits: { labelEn: "Estimated Units", labelFr: "Unites estimees", kind: "number" },
  hasElectricity: { labelEn: "Has Electricity", labelFr: "A l'electricite", kind: "boolean" },
  constructionMaterial: {
    labelEn: "Construction Material",
    labelFr: "Materiau de construction",
    kind: "single_select",
    options: [
      option("concrete", "Concrete", "Beton"),
      option("brick", "Brick", "Brique"),
      option("wood", "Wood", "Bois"),
      option("metal", "Metal", "Metal"),
      option("mixed", "Mixed", "Mixte"),
      option("other", "Other", "Autre"),
    ],
  },
  hasCommercialGround: { labelEn: "Commercial Ground Floor", labelFr: "Rez-de-chaussee commercial", kind: "boolean" },
};

export function getEnrichFieldLabel(field: string, lang: "en" | "fr"): string {
  const spec = ENRICH_FIELD_CATALOG[field];
  if (!spec) return field;
  return lang === "fr" ? spec.labelFr : spec.labelEn;
}
