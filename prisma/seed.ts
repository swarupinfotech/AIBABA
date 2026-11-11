import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/auth/password";

const prisma = new PrismaClient();

const CITIES: Array<[string, string, string, number, number, string]> = [
  ["New Delhi", "Delhi", "India", 28.6139, 77.209, "Asia/Kolkata"],
  ["Mumbai", "Maharashtra", "India", 19.076, 72.8777, "Asia/Kolkata"],
  ["Bengaluru", "Karnataka", "India", 12.9716, 77.5946, "Asia/Kolkata"],
  ["Chennai", "Tamil Nadu", "India", 13.0827, 80.2707, "Asia/Kolkata"],
  ["Kolkata", "West Bengal", "India", 22.5726, 88.3639, "Asia/Kolkata"],
  ["Hyderabad", "Telangana", "India", 17.385, 78.4867, "Asia/Kolkata"],
  ["Ahmedabad", "Gujarat", "India", 23.0225, 72.5714, "Asia/Kolkata"],
  ["Pune", "Maharashtra", "India", 18.5204, 73.8567, "Asia/Kolkata"],
  ["Jaipur", "Rajasthan", "India", 26.9124, 75.7873, "Asia/Kolkata"],
  ["Lucknow", "Uttar Pradesh", "India", 26.8467, 80.9462, "Asia/Kolkata"],
  ["Kanpur", "Uttar Pradesh", "India", 26.4499, 80.3319, "Asia/Kolkata"],
  ["Nagpur", "Maharashtra", "India", 21.1458, 79.0882, "Asia/Kolkata"],
  ["Indore", "Madhya Pradesh", "India", 22.7196, 75.8577, "Asia/Kolkata"],
  ["Bhopal", "Madhya Pradesh", "India", 23.2599, 77.4126, "Asia/Kolkata"],
  ["Patna", "Bihar", "India", 25.5941, 85.1376, "Asia/Kolkata"],
  ["Varanasi", "Uttar Pradesh", "India", 25.3176, 82.9739, "Asia/Kolkata"],
  ["Prayagraj", "Uttar Pradesh", "India", 25.4358, 81.8463, "Asia/Kolkata"],
  ["Agra", "Uttar Pradesh", "India", 27.1767, 78.0081, "Asia/Kolkata"],
  ["Meerut", "Uttar Pradesh", "India", 28.9845, 77.7064, "Asia/Kolkata"],
  ["Ghaziabad", "Uttar Pradesh", "India", 28.6692, 77.4538, "Asia/Kolkata"],
  ["Noida", "Uttar Pradesh", "India", 28.5355, 77.391, "Asia/Kolkata"],
  ["Gurugram", "Haryana", "India", 28.4595, 77.0266, "Asia/Kolkata"],
  ["Faridabad", "Haryana", "India", 28.4089, 77.3178, "Asia/Kolkata"],
  ["Chandigarh", "Chandigarh", "India", 30.7333, 76.7794, "Asia/Kolkata"],
  ["Amritsar", "Punjab", "India", 31.634, 74.8723, "Asia/Kolkata"],
  ["Ludhiana", "Punjab", "India", 30.901, 75.8573, "Asia/Kolkata"],
  ["Jalandhar", "Punjab", "India", 31.326, 75.5762, "Asia/Kolkata"],
  ["Dehradun", "Uttarakhand", "India", 30.3165, 78.0322, "Asia/Kolkata"],
  ["Haridwar", "Uttarakhand", "India", 29.9457, 78.1642, "Asia/Kolkata"],
  ["Shimla", "Himachal Pradesh", "India", 31.1048, 77.1734, "Asia/Kolkata"],
  ["Jammu", "Jammu and Kashmir", "India", 32.7266, 74.857, "Asia/Kolkata"],
  ["Srinagar", "Jammu and Kashmir", "India", 34.0837, 74.7973, "Asia/Kolkata"],
  ["Ranchi", "Jharkhand", "India", 23.3441, 85.3096, "Asia/Kolkata"],
  ["Jamshedpur", "Jharkhand", "India", 22.8046, 86.2029, "Asia/Kolkata"],
  ["Bhubaneswar", "Odisha", "India", 20.2961, 85.8245, "Asia/Kolkata"],
  ["Cuttack", "Odisha", "India", 20.4625, 85.8828, "Asia/Kolkata"],
  ["Raipur", "Chhattisgarh", "India", 21.2514, 81.6296, "Asia/Kolkata"],
  ["Guwahati", "Assam", "India", 26.1445, 91.7362, "Asia/Kolkata"],
  ["Dibrugarh", "Assam", "India", 27.4728, 94.912, "Asia/Kolkata"],
  ["Shillong", "Meghalaya", "India", 25.5788, 91.8933, "Asia/Kolkata"],
  ["Imphal", "Manipur", "India", 24.817, 93.9368, "Asia/Kolkata"],
  ["Aizawl", "Mizoram", "India", 23.7271, 92.7176, "Asia/Kolkata"],
  ["Agartala", "Tripura", "India", 23.8315, 91.2868, "Asia/Kolkata"],
  ["Kohima", "Nagaland", "India", 25.6751, 94.1086, "Asia/Kolkata"],
  ["Itanagar", "Arunachal Pradesh", "India", 27.0844, 93.6053, "Asia/Kolkata"],
  ["Gangtok", "Sikkim", "India", 27.3389, 88.6065, "Asia/Kolkata"],
  ["Panaji", "Goa", "India", 15.4909, 73.8278, "Asia/Kolkata"],
  ["Thiruvananthapuram", "Kerala", "India", 8.5241, 76.9366, "Asia/Kolkata"],
  ["Kochi", "Kerala", "India", 9.9312, 76.2673, "Asia/Kolkata"],
  ["Kozhikode", "Kerala", "India", 11.2588, 75.7804, "Asia/Kolkata"],
  ["Coimbatore", "Tamil Nadu", "India", 11.0168, 76.9558, "Asia/Kolkata"],
  ["Madurai", "Tamil Nadu", "India", 9.9252, 78.1198, "Asia/Kolkata"],
  ["Tiruchirappalli", "Tamil Nadu", "India", 10.7905, 78.7047, "Asia/Kolkata"],
  ["Salem", "Tamil Nadu", "India", 11.6643, 78.146, "Asia/Kolkata"],
  ["Vijayawada", "Andhra Pradesh", "India", 16.5062, 80.648, "Asia/Kolkata"],
  ["Visakhapatnam", "Andhra Pradesh", "India", 17.6868, 83.2185, "Asia/Kolkata"],
  ["Tirupati", "Andhra Pradesh", "India", 13.6288, 79.4192, "Asia/Kolkata"],
  ["Mysuru", "Karnataka", "India", 12.2958, 76.6394, "Asia/Kolkata"],
  ["Mangaluru", "Karnataka", "India", 12.9141, 74.856, "Asia/Kolkata"],
  ["Hubballi", "Karnataka", "India", 15.3647, 75.124, "Asia/Kolkata"],
  ["Surat", "Gujarat", "India", 21.1702, 72.8311, "Asia/Kolkata"],
  ["Vadodara", "Gujarat", "India", 22.3072, 73.1812, "Asia/Kolkata"],
  ["Rajkot", "Gujarat", "India", 22.3039, 70.8022, "Asia/Kolkata"],
  ["Bhavnagar", "Gujarat", "India", 21.7645, 72.1519, "Asia/Kolkata"],
  ["Nashik", "Maharashtra", "India", 19.9975, 73.7898, "Asia/Kolkata"],
  ["Aurangabad", "Maharashtra", "India", 19.8762, 75.3433, "Asia/Kolkata"],
  ["Solapur", "Maharashtra", "India", 17.6599, 75.9064, "Asia/Kolkata"],
  ["Kolhapur", "Maharashtra", "India", 16.705, 74.2433, "Asia/Kolkata"],
  ["Udaipur", "Rajasthan", "India", 24.5854, 73.7125, "Asia/Kolkata"],
  ["Jodhpur", "Rajasthan", "India", 26.2389, 73.0243, "Asia/Kolkata"],
  ["Kota", "Rajasthan", "India", 25.2138, 75.8648, "Asia/Kolkata"],
  ["Ajmer", "Rajasthan", "India", 26.4499, 74.6399, "Asia/Kolkata"],
  ["Bikaner", "Rajasthan", "India", 28.0229, 73.3119, "Asia/Kolkata"],
  ["Gwalior", "Madhya Pradesh", "India", 26.2183, 78.1828, "Asia/Kolkata"],
  ["Jabalpur", "Madhya Pradesh", "India", 23.1815, 79.9864, "Asia/Kolkata"],
  ["Ujjain", "Madhya Pradesh", "India", 23.1765, 75.7885, "Asia/Kolkata"],
  ["Lagos", "Lagos", "Nigeria", 6.5244, 3.3792, "Africa/Lagos"],
  ["Nairobi", "Nairobi", "Kenya", -1.2921, 36.8219, "Africa/Nairobi"],
  ["Johannesburg", "Gauteng", "South Africa", -26.2041, 28.0473, "Africa/Johannesburg"],
  ["Cape Town", "Western Cape", "South Africa", -33.9249, 18.4241, "Africa/Johannesburg"],
  ["Cairo", "Cairo", "Egypt", 30.0444, 31.2357, "Africa/Cairo"],
  ["Dubai", "Dubai", "United Arab Emirates", 25.2048, 55.2708, "Asia/Dubai"],
  ["Abu Dhabi", "Abu Dhabi", "United Arab Emirates", 24.4539, 54.3773, "Asia/Dubai"],
  ["Doha", "Doha", "Qatar", 25.2854, 51.531, "Asia/Qatar"],
  ["Riyadh", "Riyadh", "Saudi Arabia", 24.7136, 46.6753, "Asia/Riyadh"],
  ["Muscat", "Muscat", "Oman", 23.588, 58.3829, "Asia/Muscat"],
  ["Kuwait City", "Al Asimah", "Kuwait", 29.3759, 47.9774, "Asia/Kuwait"],
  ["Karachi", "Sindh", "Pakistan", 24.8607, 67.0011, "Asia/Karachi"],
  ["Lahore", "Punjab", "Pakistan", 31.5204, 74.3587, "Asia/Karachi"],
  ["Islamabad", "Islamabad", "Pakistan", 33.6844, 73.0479, "Asia/Karachi"],
  ["Dhaka", "Dhaka", "Bangladesh", 23.8103, 90.4125, "Asia/Dhaka"],
  ["Kathmandu", "Bagmati", "Nepal", 27.7172, 85.324, "Asia/Kathmandu"],
  ["Colombo", "Western", "Sri Lanka", 6.9271, 79.8612, "Asia/Colombo"],
  ["Singapore", "Singapore", "Singapore", 1.3521, 103.8198, "Asia/Singapore"],
  ["Kuala Lumpur", "Kuala Lumpur", "Malaysia", 3.139, 101.6869, "Asia/Kuala_Lumpur"],
  ["Bangkok", "Bangkok", "Thailand", 13.7563, 100.5018, "Asia/Bangkok"],
  ["Jakarta", "Jakarta", "Indonesia", -6.2088, 106.8456, "Asia/Jakarta"],
  ["Manila", "Metro Manila", "Philippines", 14.5995, 120.9842, "Asia/Manila"],
  ["Hong Kong", "Hong Kong", "China", 22.3193, 114.1694, "Asia/Hong_Kong"],
  ["Shanghai", "Shanghai", "China", 31.2304, 121.4737, "Asia/Shanghai"],
  ["Tokyo", "Tokyo", "Japan", 35.6762, 139.6503, "Asia/Tokyo"],
  ["Seoul", "Seoul", "South Korea", 37.5665, 126.978, "Asia/Seoul"],
  ["Sydney", "New South Wales", "Australia", -33.8688, 151.2093, "Australia/Sydney"],
  ["Melbourne", "Victoria", "Australia", -37.8136, 144.9631, "Australia/Melbourne"],
  ["Auckland", "Auckland", "New Zealand", -36.8509, 174.7645, "Pacific/Auckland"],
  ["London", "England", "United Kingdom", 51.5074, -0.1278, "Europe/London"],
  ["Manchester", "England", "United Kingdom", 53.4808, -2.2426, "Europe/London"],
  ["Birmingham", "England", "United Kingdom", 52.4862, -1.8904, "Europe/London"],
  ["Dublin", "Leinster", "Ireland", 53.3498, -6.2603, "Europe/Dublin"],
  ["Paris", "Île-de-France", "France", 48.8566, 2.3522, "Europe/Paris"],
  ["Berlin", "Berlin", "Germany", 52.52, 13.405, "Europe/Berlin"],
  ["Munich", "Bavaria", "Germany", 48.1351, 11.582, "Europe/Berlin"],
  ["Amsterdam", "North Holland", "Netherlands", 52.3676, 4.9041, "Europe/Amsterdam"],
  ["Brussels", "Brussels", "Belgium", 50.8503, 4.3517, "Europe/Brussels"],
  ["Zurich", "Zurich", "Switzerland", 47.3769, 8.5417, "Europe/Zurich"],
  ["Vienna", "Vienna", "Austria", 48.2082, 16.3738, "Europe/Vienna"],
  ["Rome", "Lazio", "Italy", 41.9028, 12.4964, "Europe/Rome"],
  ["Milan", "Lombardy", "Italy", 45.4642, 9.19, "Europe/Rome"],
  ["Madrid", "Madrid", "Spain", 40.4168, -3.7038, "Europe/Madrid"],
  ["Barcelona", "Catalonia", "Spain", 41.3874, 2.1686, "Europe/Madrid"],
  ["Lisbon", "Lisbon", "Portugal", 38.7223, -9.1393, "Europe/Lisbon"],
  ["Stockholm", "Stockholm", "Sweden", 59.3293, 18.0686, "Europe/Stockholm"],
  ["Oslo", "Oslo", "Norway", 59.9139, 10.7522, "Europe/Oslo"],
  ["Copenhagen", "Capital Region", "Denmark", 55.6761, 12.5683, "Europe/Copenhagen"],
  ["Helsinki", "Uusimaa", "Finland", 60.1699, 24.9384, "Europe/Helsinki"],
  ["Warsaw", "Masovia", "Poland", 52.2297, 21.0122, "Europe/Warsaw"],
  ["Prague", "Prague", "Czechia", 50.0755, 14.4378, "Europe/Prague"],
  ["Athens", "Attica", "Greece", 37.9838, 23.7275, "Europe/Athens"],
  ["Istanbul", "Istanbul", "Türkiye", 41.0082, 28.9784, "Europe/Istanbul"],
  ["Moscow", "Moscow", "Russia", 55.7558, 37.6173, "Europe/Moscow"],
  ["New York", "New York", "United States", 40.7128, -74.006, "America/New_York"],
  ["Los Angeles", "California", "United States", 34.0522, -118.2437, "America/Los_Angeles"],
  ["Chicago", "Illinois", "United States", 41.8781, -87.6298, "America/Chicago"],
  ["Houston", "Texas", "United States", 29.7604, -95.3698, "America/Chicago"],
  ["Miami", "Florida", "United States", 25.7617, -80.1918, "America/New_York"],
  ["Seattle", "Washington", "United States", 47.6062, -122.3321, "America/Los_Angeles"],
  ["Boston", "Massachusetts", "United States", 42.3601, -71.0589, "America/New_York"],
  ["Austin", "Texas", "United States", 30.2672, -97.7431, "America/Chicago"],
  ["San Francisco", "California", "United States", 37.7749, -122.4194, "America/Los_Angeles"],
  ["Toronto", "Ontario", "Canada", 43.6532, -79.3832, "America/Toronto"],
  ["Vancouver", "British Columbia", "Canada", 49.2827, -123.1207, "America/Vancouver"],
  ["Montreal", "Quebec", "Canada", 45.5017, -73.5673, "America/Toronto"],
  ["Mexico City", "Mexico City", "Mexico", 19.4326, -99.1332, "America/Mexico_City"],
  ["São Paulo", "São Paulo", "Brazil", -23.5505, -46.6333, "America/Sao_Paulo"],
  ["Rio de Janeiro", "Rio de Janeiro", "Brazil", -22.9068, -43.1729, "America/Sao_Paulo"],
  ["Buenos Aires", "Buenos Aires", "Argentina", -34.6037, -58.3816, "America/Argentina/Buenos_Aires"],
  ["Bogotá", "Bogotá", "Colombia", 4.711, -74.0721, "America/Bogota"],
  ["Lima", "Lima", "Peru", -12.0464, -77.0428, "America/Lima"],
  ["Santiago", "Santiago Metropolitan", "Chile", -33.4489, -70.6693, "America/Santiago"],
];

async function main() {
  const aiSetting = {
    provider: process.env.AI_PROVIDER || "local",
    model: process.env.AI_MODEL || "",
    temperature: 0.4,
    maxOutputTokens: 2500,
    monthlyBudgetUsd: 5,
  };
  const settings: Array<[string, unknown]> = [
    ["ai", aiSetting],
    ["astrology", { provider: "internal", ayanamsa: "LAHIRI", houseSystem: "WHOLE_SIGN", nodeType: "MEAN_NODE" }],
    ["numerology", { systems: ["CHALDEAN", "PYTHAGOREAN"], defaultSystem: "PYTHAGOREAN", mappingVersions: ["chaldean-v1", "pythagorean-v1"] }],
    ["storage", { provider: process.env.STORAGE_PROVIDER || "local", retentionDays: 365, signedUrlTtlSeconds: 300 }],
    ["reports", { shareTtlHours: 72, pdfLinkTtlSeconds: 300, maxVersions: 10 }],
  ];
  for (const [key, value] of settings) {
    await prisma.appSetting.upsert({
      where: { key },
      update: { value: JSON.stringify(value) },
      create: { key, value: JSON.stringify(value) },
    });
  }

  const plans = [
    {
      code: "FREE_PREVIEW",
      name: "Free Preview",
      description: "Explore the feature and a basic numerology preview.",
      features: ["Feature overview", "Basic numerology preview", "Limited report preview"],
      priceMinor: null,
      currency: "INR",
    },
    {
      code: "COMPLETE_READING",
      name: "Complete Life Reading",
      description: "A full combined reading with saved reports and follow-up questions.",
      features: ["All selected analysis modules", "Combined report", "Saved history", "Follow-up AI questions", "PDF download"],
      priceMinor: 49900,
      currency: "INR",
    },
  ];
  for (const plan of plans) {
    const { features, ...rest } = plan;
    await prisma.plan.upsert({
      where: { code: plan.code },
      update: { ...rest, features: JSON.stringify(features) },
      create: { ...rest, features: JSON.stringify(features) },
    });
  }

  for (const [name, region, country, latitude, longitude, timezone] of CITIES) {
    const existing = await prisma.city.findFirst({ where: { name, country } });
    if (!existing) {
      await prisma.city.create({ data: { name, region, country, latitude, longitude, timezone } });
    }
  }

  const seedDemo = process.env.SEED_DEMO_ACCOUNTS !== "false";
  if (seedDemo) {
    const demoPassword = process.env.DEMO_PASSWORD || "Aibaba@2026";
    const adminPassword = process.env.ADMIN_PASSWORD || "AibabaAdmin@2026";
    const demo = await prisma.user.upsert({
      where: { email: "demo@aibaba.app" },
      update: {},
      create: {
        email: "demo@aibaba.app",
        name: "Aarav Sharma",
        passwordHash: await hashPassword(demoPassword),
        preferredLanguage: "en",
        profile: { create: { displayName: "Aarav", country: "India", timezone: "Asia/Kolkata" } },
      },
    });
    await prisma.entitlement.upsert({
      where: { id: `demo-entitlement-${demo.id}` },
      update: { status: "ACTIVE" },
      create: {
        id: `demo-entitlement-${demo.id}`,
        userId: demo.id,
        planCode: "COMPLETE_READING",
        source: "SEED",
        status: "ACTIVE",
      },
    });
    await prisma.user.upsert({
      where: { email: "admin@aibaba.app" },
      update: {},
      create: {
        email: "admin@aibaba.app",
        name: "AIBABA Operations",
        passwordHash: await hashPassword(adminPassword),
        role: "SUPER_ADMIN",
        profile: { create: { displayName: "Operations", country: "India", timezone: "Asia/Kolkata" } },
      },
    });
  }

  console.log(
    `Seeded ${CITIES.length} cities, ${plans.length} plans, settings${seedDemo ? ", demo and admin accounts" : ""}.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
