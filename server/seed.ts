import { db } from "./db";
import { listings, messages, favorites, reviews, events, eventRsvps, offers, orders, referrals, listingAnalytics, notifications, reports, savedSearches } from "@shared/schema";
import { users } from "@shared/models/auth";
import { sql } from "drizzle-orm";

const FIRST_NAMES = [
  "Emma", "Liam", "Olivia", "Noah", "Ava", "Ethan", "Sophia", "Mason",
  "Isabella", "William", "Mia", "James", "Charlotte", "Benjamin", "Amelia",
  "Lucas", "Harper", "Henry", "Evelyn", "Alexander", "Abigail", "Daniel",
  "Emily", "Michael", "Ella", "Sebastian", "Elizabeth", "Jack", "Camila",
  "Aiden", "Luna", "Owen", "Sofia", "Samuel", "Avery", "Ryan", "Mila",
  "Nathan", "Aria", "Caleb", "Scarlett", "Christian", "Penelope", "Dylan",
  "Layla", "Isaac", "Chloe", "Luke", "Victoria", "Jayden", "Madison",
  "Julian", "Eleanor", "Gabriel", "Grace", "Carter", "Nora", "Joshua",
  "Riley", "Andrew", "Zoey", "Lincoln", "Hannah", "Mateo", "Hazel",
  "David", "Lily", "John", "Ellie", "Wyatt", "Violet", "Matthew",
  "Lillian", "Leo", "Zoe", "Asher", "Stella", "Connor", "Aurora",
  "Ezra", "Natalie", "Adrian", "Emilia", "Miles", "Everly", "Eli",
  "Leah", "Nolan", "Aubrey", "Chase", "Willow", "Thomas", "Addison",
  "Jordan", "Lucy", "Christopher", "Audrey", "Maverick", "Bella",
];

const LAST_NAMES = [
  "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller",
  "Davis", "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez",
  "Wilson", "Anderson", "Thomas", "Taylor", "Moore", "Jackson", "Martin",
  "Lee", "Perez", "Thompson", "White", "Harris", "Sanchez", "Clark",
  "Ramirez", "Lewis", "Robinson", "Walker", "Young", "Allen", "King",
  "Wright", "Scott", "Torres", "Nguyen", "Hill", "Flores", "Green",
  "Adams", "Nelson", "Baker", "Hall", "Rivera", "Campbell", "Mitchell",
  "Carter", "Roberts",
];

const CITIES: Array<{ city: string; country: string; lat: string; lng: string }> = [
  { city: "Austin", country: "USA", lat: "30.2672", lng: "-97.7431" },
  { city: "Portland", country: "USA", lat: "45.5152", lng: "-122.6784" },
  { city: "Seattle", country: "USA", lat: "47.6062", lng: "-122.3321" },
  { city: "Denver", country: "USA", lat: "39.7392", lng: "-104.9903" },
  { city: "Chicago", country: "USA", lat: "41.8781", lng: "-87.6298" },
  { city: "San Francisco", country: "USA", lat: "37.7749", lng: "-122.4194" },
  { city: "New York", country: "USA", lat: "40.7128", lng: "-74.0060" },
  { city: "Los Angeles", country: "USA", lat: "34.0522", lng: "-118.2437" },
  { city: "Miami", country: "USA", lat: "25.7617", lng: "-80.1918" },
  { city: "Nashville", country: "USA", lat: "36.1627", lng: "-86.7816" },
  { city: "Toronto", country: "Canada", lat: "43.6532", lng: "-79.3832" },
  { city: "Vancouver", country: "Canada", lat: "49.2827", lng: "-123.1207" },
  { city: "London", country: "UK", lat: "51.5074", lng: "-0.1278" },
  { city: "Manchester", country: "UK", lat: "53.4808", lng: "-2.2426" },
  { city: "Sydney", country: "Australia", lat: "-33.8688", lng: "151.2093" },
  { city: "Melbourne", country: "Australia", lat: "-37.8136", lng: "144.9631" },
  { city: "Berlin", country: "Germany", lat: "52.5200", lng: "13.4050" },
  { city: "Paris", country: "France", lat: "48.8566", lng: "2.3522" },
  { city: "Madrid", country: "Spain", lat: "40.4168", lng: "-3.7038" },
  { city: "Mexico City", country: "Mexico", lat: "19.4326", lng: "-99.1332" },
];

const LISTING_TEMPLATES = [
  { title: "Vintage Oak Coffee Table", desc: "Beautiful solid oak coffee table with minor surface character marks. Sturdy and elegant.", cat: "Furniture", price: 4500 },
  { title: "Mid-Century Modern Bookshelf", desc: "Walnut bookshelf from the 1960s, 5 shelves, excellent condition. A real conversation piece.", cat: "Furniture", price: 12000 },
  { title: "Leather Recliner Chair", desc: "Dark brown genuine leather recliner. Very comfortable, minor wear on armrests.", cat: "Furniture", price: 8500 },
  { title: "IKEA Kallax Shelf Unit", desc: "White 4x4 Kallax shelf with 8 cube inserts. Some shelf sag but very functional.", cat: "Furniture", price: 3500 },
  { title: "Antique Dining Table Set", desc: "Mahogany dining table with 6 chairs. Seats 8 with extension leaf. Circa 1940s.", cat: "Furniture", price: 35000 },
  { title: "Sony PlayStation 5 Bundle", desc: "PS5 disc edition with 2 controllers, charging dock, and 4 games. Perfect condition.", cat: "Electronics", price: 35000 },
  { title: "MacBook Pro 2021 - 14 inch", desc: "M1 Pro chip, 16GB RAM, 512GB SSD. Battery health 89%. Includes charger.", cat: "Electronics", price: 95000 },
  { title: "Samsung 55\" 4K Smart TV", desc: "Crystal UHD display, built-in streaming apps. Remote included. Wall mount bracket too.", cat: "Electronics", price: 25000 },
  { title: "Bose QuietComfort 45 Headphones", desc: "Noise-cancelling over-ear headphones. Black. Comes with carrying case and cable.", cat: "Electronics", price: 18000 },
  { title: "Nintendo Switch OLED", desc: "White Joy-Con edition with dock, 3 games including Zelda TOTK. Screen protector applied.", cat: "Electronics", price: 22000 },
  { title: "Vintage Denim Jacket Collection", desc: "5 vintage denim jackets from the 80s-90s, sizes M-L. Levi's, Wrangler, Lee.", cat: "Clothing", price: 12000 },
  { title: "Designer Handbag - Coach", desc: "Authentic Coach crossbody bag in tan leather. Dust bag included. Like new.", cat: "Clothing", price: 9500 },
  { title: "Men's Suit - Hugo Boss", desc: "Navy blue Hugo Boss suit, size 42R. Worn twice. Includes matching tie.", cat: "Clothing", price: 15000 },
  { title: "Vintage Band T-Shirt Lot", desc: "12 vintage band tees from the 90s. Nirvana, Pearl Jam, Soundgarden, etc. Mixed sizes.", cat: "Clothing", price: 8000 },
  { title: "Winter Coat - Canada Goose", desc: "Expedition parka in black, size L. Authentic with hologram tag. Very warm.", cat: "Clothing", price: 45000 },
  { title: "Harry Potter Complete Box Set", desc: "All 7 hardcover books in original box. Some shelf wear but pages are clean.", cat: "Books", price: 4500 },
  { title: "Textbook Bundle - Computer Science", desc: "15 CS textbooks covering algorithms, databases, networking, and AI. College level.", cat: "Books", price: 6000 },
  { title: "Rare First Edition - To Kill a Mockingbird", desc: "1960 first edition, good condition with dust jacket. A collector's dream.", cat: "Books", price: 85000 },
  { title: "LEGO Star Wars Collection", desc: "5 complete sets including Millennium Falcon. All minifigs and instructions included.", cat: "Toys", price: 15000 },
  { title: "Barbie Dream House + Accessories", desc: "3-story dream house with furniture, car, and 12 Barbie dolls. Great condition.", cat: "Toys", price: 7500 },
  { title: "Outdoor Patio Set - 5 Piece", desc: "Wicker patio set with cushions. Table and 4 chairs. Weather resistant.", cat: "Home & Garden", price: 20000 },
  { title: "Dyson V11 Vacuum Cleaner", desc: "Cordless stick vacuum with multiple attachments. Battery holds good charge.", cat: "Home & Garden", price: 22000 },
  { title: "Weber Gas Grill - 3 Burner", desc: "Stainless steel gas grill with side burner. Cover included. Used 2 seasons.", cat: "Home & Garden", price: 18000 },
  { title: "Mountain Bike - Trek Marlin 7", desc: "2022 model, size M. Hydraulic disc brakes. Some trail wear but rides great.", cat: "Sports", price: 45000 },
  { title: "Complete Home Gym Setup", desc: "Adjustable bench, Olympic barbell, 300lb plates, power rack, dumbbells. Moving sale!", cat: "Sports", price: 85000 },
  { title: "Golf Club Set - Callaway", desc: "Full set with bag, 14 clubs including driver, woods, irons, wedges, and putter.", cat: "Sports", price: 35000 },
  { title: "Antique Grandfather Clock", desc: "Working pendulum clock from 1890s. Westminster chimes. Recently serviced.", cat: "Antiques", price: 120000 },
  { title: "Victorian Writing Desk", desc: "Ornate mahogany writing desk with brass hardware. Original inkwell holders.", cat: "Antiques", price: 65000 },
  { title: "1950s Jukebox - Wurlitzer", desc: "Restored Wurlitzer jukebox, plays 45s. All lights work. A stunning centerpiece.", cat: "Vintage", price: 250000 },
  { title: "Vintage Polaroid Camera Collection", desc: "3 Polaroid cameras: SX-70, OneStep, and 600. All tested and working.", cat: "Vintage", price: 15000 },
  { title: "Retro Record Player - Technics", desc: "Technics SL-1200 turntable. The DJ standard. Excellent condition with dust cover.", cat: "Vintage", price: 45000 },
  { title: "DeWalt 20V Max Power Tool Set", desc: "5-tool combo: drill, impact driver, circular saw, reciprocating saw, light. 2 batteries.", cat: "Tools", price: 35000 },
  { title: "Workshop Workbench - Heavy Duty", desc: "Steel frame workbench with pegboard and storage drawers. 6ft long. Very sturdy.", cat: "Tools", price: 25000 },
  { title: "Baseball Card Collection", desc: "500+ cards from 1980-2000. Includes several rookie cards. Stored in binder sleeves.", cat: "Collectibles", price: 15000 },
  { title: "Vintage Coin Set - Silver Dollars", desc: "20 Morgan silver dollars spanning 1878-1921. Various conditions, all genuine.", cat: "Collectibles", price: 45000 },
  { title: "Sterling Silver Charm Bracelet", desc: "Italian sterling silver bracelet with 15 charms from travels. Beautiful and meaningful.", cat: "Jewelry", price: 8500 },
  { title: "Diamond Stud Earrings", desc: "0.5 carat total weight, round brilliant cut. 14k white gold settings. Certified.", cat: "Jewelry", price: 65000 },
  { title: "KitchenAid Stand Mixer", desc: "Artisan 5-quart in Empire Red. Includes 3 attachments. Works perfectly.", cat: "Appliances", price: 15000 },
  { title: "Instant Pot Duo Plus", desc: "8-quart, 9-in-1 pressure cooker. Used a handful of times. Like new with box.", cat: "Appliances", price: 5500 },
  { title: "Baby Stroller - UPPAbaby Vista", desc: "2023 model with bassinet and toddler seat. Rain cover included. Barely used.", cat: "Baby & Kids", price: 35000 },
  { title: "Kids' Play Kitchen Set", desc: "Wooden play kitchen with accessories. Pots, pans, play food. Hours of fun!", cat: "Baby & Kids", price: 6500 },
  { title: "Moving Sale - Everything Must Go!", desc: "Household items, kitchenware, decor, tools, and more. Priced to sell fast.", cat: "Other", price: 0 },
  { title: "Free Piano - You Haul", desc: "Upright piano, needs tuning but all keys work. Must be picked up by Saturday.", cat: "Other", price: 0 },
];

const SHOP_TEMPLATES = [
  { title: "Treasure Trove Thrift Store", desc: "Curated vintage and secondhand finds. New inventory weekly! Furniture, clothing, accessories and home decor.", cat: "Clothing", hours: "Mon-Sat 10am-6pm, Sun 12-5pm", phone: "555-0100" },
  { title: "The Book Barn", desc: "Thousands of used books at unbeatable prices. Fiction, non-fiction, textbooks, and rare finds.", cat: "Books", hours: "Tue-Sun 9am-7pm", phone: "555-0101" },
  { title: "Retro Revival", desc: "Vintage clothing, vinyl records, and retro decor from the 60s-90s. A nostalgia lover's paradise.", cat: "Vintage", hours: "Wed-Mon 11am-8pm", phone: "555-0102" },
  { title: "Second Chance Furniture", desc: "Quality pre-owned furniture at fraction of retail. We refinish and restore pieces too.", cat: "Furniture", hours: "Mon-Fri 9am-5pm, Sat 10am-4pm", phone: "555-0103" },
  { title: "Green Planet Resale", desc: "Eco-friendly thrift shop. Clothing, accessories, and household items. All proceeds support local charities.", cat: "Clothing", hours: "Daily 10am-7pm", phone: "555-0104" },
  { title: "Tech Refresh Electronics", desc: "Refurbished electronics with warranty. Laptops, phones, tablets, and gaming consoles.", cat: "Electronics", hours: "Mon-Sat 10am-8pm", phone: "555-0105" },
  { title: "Little Ones Consignment", desc: "Gently used children's clothing, toys, and gear. Sizes newborn to teen. Affordable prices.", cat: "Baby & Kids", hours: "Mon-Fri 10am-6pm, Sat 10am-3pm", phone: "555-0106" },
  { title: "Antique Alley", desc: "Three floors of antiques, collectibles, and curiosities. From fine china to folk art.", cat: "Antiques", hours: "Thu-Mon 10am-5pm", phone: "555-0107" },
  { title: "The Tool Shed", desc: "Used power tools, hand tools, and workshop equipment. We buy, sell, and trade.", cat: "Tools", hours: "Mon-Sat 8am-5pm", phone: "555-0108" },
  { title: "Sparkle & Shine Jewelry", desc: "Pre-owned fine jewelry, estate pieces, and vintage costume jewelry. Appraisals available.", cat: "Jewelry", hours: "Tue-Sat 11am-6pm", phone: "555-0109" },
];

const PHOTO_URLS: Record<string, string[]> = {
  "Furniture": [
    "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=800&q=80",
    "https://images.unsplash.com/photo-1506439773649-6e0eb8cfb237?w=800&q=80",
    "https://images.unsplash.com/photo-1524758631624-e2822e304c36?w=800&q=80",
  ],
  "Electronics": [
    "https://images.unsplash.com/photo-1606144042614-b2417e99c4e3?w=800&q=80",
    "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=800&q=80",
    "https://images.unsplash.com/photo-1593642632559-0c6d3fc62b89?w=800&q=80",
  ],
  "Clothing": [
    "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800&q=80",
    "https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?w=800&q=80",
    "https://images.unsplash.com/photo-1558171813-01342daa26a4?w=800&q=80",
  ],
  "Books": [
    "https://images.unsplash.com/photo-1526243741027-444d633d7365?w=800&q=80",
    "https://images.unsplash.com/photo-1524578271613-d550eacf6090?w=800&q=80",
  ],
  "Toys": [
    "https://images.unsplash.com/photo-1558060370-d644479cb6f7?w=800&q=80",
    "https://images.unsplash.com/photo-1596461404969-9ae70f2830c1?w=800&q=80",
  ],
  "Home & Garden": [
    "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=800&q=80",
    "https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=800&q=80",
  ],
  "Sports": [
    "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&q=80",
    "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=800&q=80",
  ],
  "Antiques": [
    "https://images.unsplash.com/photo-1507473885765-e6ed057ab6fe?w=800&q=80",
    "https://images.unsplash.com/photo-1513519245088-0e12902e5a38?w=800&q=80",
  ],
  "Vintage": [
    "https://images.unsplash.com/photo-1483412033650-1015ddeb83d1?w=800&q=80",
    "https://images.unsplash.com/photo-1558171813-01342daa26a4?w=800&q=80",
  ],
  "Tools": [
    "https://images.unsplash.com/photo-1504148455328-c376907d081c?w=800&q=80",
    "https://images.unsplash.com/photo-1530124566582-a45a7e3e29f0?w=800&q=80",
  ],
  "Collectibles": [
    "https://images.unsplash.com/photo-1483412033650-1015ddeb83d1?w=800&q=80",
    "https://images.unsplash.com/photo-1513519245088-0e12902e5a38?w=800&q=80",
  ],
  "Jewelry": [
    "https://images.unsplash.com/photo-1515562141589-67f0d9e6e6ef?w=800&q=80",
    "https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=800&q=80",
  ],
  "Appliances": [
    "https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=800&q=80",
    "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800&q=80",
  ],
  "Baby & Kids": [
    "https://images.unsplash.com/photo-1558060370-d644479cb6f7?w=800&q=80",
    "https://images.unsplash.com/photo-1596461404969-9ae70f2830c1?w=800&q=80",
  ],
  "Other": [
    "https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=800&q=80",
    "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800&q=80",
  ],
};

const CONDITIONS = ["new", "like_new", "good", "fair", "poor"] as const;

const MESSAGE_TEMPLATES = [
  "Hi! Is this still available?",
  "Would you take ${price} for this?",
  "Can I come pick it up this weekend?",
  "Great listing! What's the lowest you'd go?",
  "Is the condition as described? Any hidden damage?",
  "I'm very interested! Can you hold it for me until tomorrow?",
  "Does this come with the original packaging?",
  "Would you consider a trade?",
  "I'm nearby, can I swing by today to take a look?",
  "Has anyone else expressed interest in this?",
  "Can you deliver or is pickup only?",
  "Love this! Is it pet-free and smoke-free home?",
  "Thanks for getting back to me so quickly!",
  "Perfect, I'll take it. When can I pick up?",
  "Sorry, I found something else. Thanks though!",
];

const REVIEW_COMMENTS = [
  "Great seller! Item was exactly as described.",
  "Fast response and easy pickup. Highly recommend!",
  "Item was in better condition than expected. Very happy!",
  "Smooth transaction, would buy from again.",
  "Seller was very friendly and flexible with pickup time.",
  "Item had a small defect not mentioned but still okay overall.",
  "Amazing deal! The seller even threw in some extras.",
  "A bit slow to respond but the item was great.",
  "Exactly what I was looking for. Thank you!",
  "Professional and trustworthy. Five stars!",
  "The item was clean and well-maintained. Impressed!",
  "Quick and easy. Would recommend to friends.",
];

const EVENT_TITLES = [
  "Spring Community Yard Sale",
  "Neighborhood Block Party Sale",
  "Moving Sale Extravaganza",
  "Multi-Family Garage Sale",
  "Holiday Clearance Sale",
  "Estate Sale - Everything Must Go",
  "Vintage & Antique Pop-Up Market",
  "Kids' Toy & Clothing Swap",
  "Tech & Electronics Clearance",
  "Furniture Blowout Sale",
  "Book Lover's Sidewalk Sale",
  "Garden & Outdoor Equipment Sale",
];

const EVENT_PHOTOS: string[][] = [
  [
    "https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=800&q=80",
    "https://images.unsplash.com/photo-1531058020387-3be344556be6?w=800&q=80",
  ],
  [
    "https://images.unsplash.com/photo-1513519245088-0e12902e35ca?w=800&q=80",
    "https://images.unsplash.com/photo-1472851294608-062f824d29cc?w=800&q=80",
  ],
  [
    "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=800&q=80",
    "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800&q=80",
  ],
  [
    "https://images.unsplash.com/photo-1607082349566-187342175e2f?w=800&q=80",
    "https://images.unsplash.com/photo-1555529669-e69e7aa0ba9a?w=800&q=80",
  ],
  [
    "https://images.unsplash.com/photo-1528698827591-e19cef1a992c?w=800&q=80",
    "https://images.unsplash.com/photo-1488459716781-31db52582fe9?w=800&q=80",
  ],
  [
    "https://images.unsplash.com/photo-1555529771-835f59fc5efa?w=800&q=80",
    "https://images.unsplash.com/photo-1534723452862-4c874018d66d?w=800&q=80",
  ],
  [
    "https://images.unsplash.com/photo-1567401893414-76b7b1e5a7a5?w=800&q=80",
    "https://images.unsplash.com/photo-1481437156560-3205f6a55acc?w=800&q=80",
  ],
  [
    "https://images.unsplash.com/photo-1590874103328-eac38a683ce7?w=800&q=80",
    "https://images.unsplash.com/photo-1604719312566-8912e9227c6a?w=800&q=80",
  ],
];

function rand<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function daysAgo(d: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - d);
  date.setHours(randInt(6, 22), randInt(0, 59), 0, 0);
  return date;
}

function daysFromNow(d: number): Date {
  const date = new Date();
  date.setDate(date.getDate() + d);
  date.setHours(randInt(8, 18), 0, 0, 0);
  return date;
}

function getPhotos(category: string): string[] {
  const urls = PHOTO_URLS[category] || PHOTO_URLS["Other"];
  const count = randInt(2, Math.min(urls.length, 3));
  return urls.slice(0, count);
}

async function seed() {
  console.log("Seeding YARDEES database with 100 users and history...\n");

  console.log("Clearing existing data...");
  await db.execute(sql`DELETE FROM listing_analytics`);
  await db.execute(sql`DELETE FROM notifications`);
  await db.execute(sql`DELETE FROM saved_searches`);
  await db.execute(sql`DELETE FROM reports`);
  await db.execute(sql`DELETE FROM event_rsvps`);
  await db.execute(sql`DELETE FROM event_participants`);
  await db.execute(sql`DELETE FROM events`);
  await db.execute(sql`DELETE FROM orders`);
  await db.execute(sql`DELETE FROM offers`);
  await db.execute(sql`DELETE FROM reviews`);
  await db.execute(sql`DELETE FROM favorites`);
  await db.execute(sql`DELETE FROM messages`);
  await db.execute(sql`DELETE FROM shop_suggestions`);
  await db.execute(sql`DELETE FROM verification_requests`);
  await db.execute(sql`DELETE FROM referrals`);
  await db.execute(sql`DELETE FROM listings`);
  await db.execute(sql`DELETE FROM users WHERE auth_type = 'seed'`);

  console.log("Creating 100 users...");
  const userIds: string[] = [];
  for (let i = 0; i < 100; i++) {
    const firstName = FIRST_NAMES[i % FIRST_NAMES.length];
    const lastName = LAST_NAMES[i % LAST_NAMES.length];
    const userId = `seed-user-${i + 1}`;
    const createdAt = daysAgo(randInt(7, 180));

    await db.insert(users).values({
      id: userId,
      email: `user${i + 1}@yardees-demo.com`,
      firstName,
      lastName,
      displayName: i % 5 === 0 ? `${firstName}${lastName[0]}` : undefined,
      authType: "seed",
      referralCode: `REF${String(i + 1).padStart(4, "0")}`,
      verificationLevel: i < 30 ? "id_verified" : i < 60 ? "email_verified" : "unverified",
      boostCredits: i % 7 === 0 ? randInt(1, 20) : 0,
      transactionCount: randInt(0, 25),
      reviewCount: 0,
      createdAt,
      updatedAt: createdAt,
    }).onConflictDoUpdate({
      target: users.id,
      set: { firstName, lastName, authType: "seed" },
    });

    userIds.push(userId);
  }
  console.log(`  Created ${userIds.length} users`);

  console.log("Creating listings...");
  const listingIds: number[] = [];
  const listingUserMap: Record<number, string> = {};

  for (let i = 0; i < 200; i++) {
    const userId = userIds[i % 100];
    const loc = rand(CITIES);
    const template = rand(LISTING_TEMPLATES);
    const condition = rand([...CONDITIONS]);
    const isBoosted = i < 15;
    const boostType = isBoosted ? rand(["category", "featured", "spotlight"] as const) : null;
    const isSold = i > 160;
    const createdDays = randInt(1, 90);
    const photos = getPhotos(template.cat);
    const titleSuffix = i > 42 ? ` #${i - 42}` : "";

    const [inserted] = await db.insert(listings).values({
      userId,
      title: template.title + titleSuffix,
      description: template.desc,
      price: template.price === 0 ? 0 : template.price + randInt(-500, 2000),
      category: template.cat,
      listingType: "individual",
      address: `${randInt(100, 9999)} ${rand(["Main", "Oak", "Maple", "Pine", "Cedar", "Elm", "Park", "Lake"])} ${rand(["St", "Ave", "Rd", "Blvd", "Dr", "Ln"])}`,
      country: loc.country,
      city: loc.city,
      photos,
      sellerContact: `user${(i % 100) + 1}@yardees-demo.com`,
      isShop: false,
      isBoosted,
      boostType,
      boostExpiresAt: isBoosted ? daysFromNow(randInt(3, 30)) : null,
      isSold,
      condition,
      isNegotiable: Math.random() > 0.4,
      privacyLevel: rand(["open", "hidden", "request", "verified"]),
      viewCount: randInt(5, 500),
      currency: loc.country === "UK" ? "GBP" : loc.country === "Canada" ? "CAD" : loc.country === "Australia" ? "AUD" : loc.country === "Germany" || loc.country === "France" || loc.country === "Spain" ? "EUR" : loc.country === "Mexico" ? "MXN" : "USD",
      lat: loc.lat,
      lng: loc.lng,
      expiresAt: daysFromNow(randInt(10, 60)),
      createdAt: daysAgo(createdDays),
    }).returning();

    if (inserted) {
      listingIds.push(inserted.id);
      listingUserMap[inserted.id] = userId;
    }
  }

  console.log("Creating yard sale listings...");
  for (let i = 0; i < 20; i++) {
    const userId = userIds[randInt(0, 99)];
    const loc = rand(CITIES);
    const photos = getPhotos(rand(["Furniture", "Clothing", "Electronics"]));

    const [inserted] = await db.insert(listings).values({
      userId,
      title: `${rand(["Big", "Huge", "Annual", "Spring", "Summer", "Weekend"])} Yard Sale - ${rand(["Everything Must Go", "Great Deals", "Multi-Family", "Moving Sale", "Downsizing"])}`,
      description: "Multiple categories of items available. Furniture, clothing, electronics, toys, kitchen items, and more! Come early for best selection.",
      price: 0,
      category: rand(["Furniture", "Clothing", "Electronics", "Home & Garden", "Other"]),
      subCategories: ["Furniture", "Clothing", "Electronics", "Toys", "Home & Garden"].slice(0, randInt(2, 5)),
      listingType: "yard_sale",
      address: `${randInt(100, 9999)} ${rand(["Oak", "Maple", "Cedar", "Elm"])} ${rand(["St", "Ave", "Dr"])}`,
      country: loc.country,
      city: loc.city,
      photos,
      sellerContact: `yardsale${i}@yardees-demo.com`,
      isShop: false,
      isBoosted: i < 3,
      boostType: i < 3 ? "featured" : null,
      boostExpiresAt: i < 3 ? daysFromNow(14) : null,
      condition: "good",
      privacyLevel: "open",
      viewCount: randInt(20, 300),
      currency: "USD",
      lat: loc.lat,
      lng: loc.lng,
      expiresAt: daysFromNow(randInt(5, 30)),
      createdAt: daysAgo(randInt(1, 30)),
    }).returning();

    if (inserted) {
      listingIds.push(inserted.id);
      listingUserMap[inserted.id] = userId;
    }
  }

  console.log("Creating shop listings...");
  for (let i = 0; i < SHOP_TEMPLATES.length; i++) {
    const shop = SHOP_TEMPLATES[i];
    const userId = userIds[80 + i];
    const loc = CITIES[i % CITIES.length];
    const photos = getPhotos(shop.cat);

    const [inserted] = await db.insert(listings).values({
      userId,
      title: shop.title,
      description: shop.desc,
      price: 0,
      category: shop.cat,
      listingType: "individual",
      address: `${randInt(100, 999)} ${rand(["Market", "Commerce", "Trade", "Main"])} ${rand(["St", "Ave", "Blvd"])}`,
      country: loc.country,
      city: loc.city,
      photos,
      sellerContact: shop.phone,
      isShop: true,
      isBoosted: i < 3,
      boostType: i < 3 ? "spotlight" : null,
      boostExpiresAt: i < 3 ? daysFromNow(30) : null,
      phone: shop.phone,
      hours: shop.hours,
      website: `https://${shop.title.toLowerCase().replace(/[^a-z0-9]/g, "")}.com`,
      privacyLevel: "open",
      viewCount: randInt(50, 1000),
      currency: "USD",
      lat: loc.lat,
      lng: loc.lng,
      createdAt: daysAgo(randInt(30, 120)),
    }).returning();

    if (inserted) {
      listingIds.push(inserted.id);
      listingUserMap[inserted.id] = userId;
    }
  }
  console.log(`  Created ${listingIds.length} listings total`);

  console.log("Creating messages...");
  let msgCount = 0;
  for (let i = 0; i < 400; i++) {
    const listingId = rand(listingIds);
    const sellerId = listingUserMap[listingId];
    let buyerId = rand(userIds);
    while (buyerId === sellerId) buyerId = rand(userIds);
    const msgAge = randInt(0, 60);

    await db.insert(messages).values({
      senderId: i % 2 === 0 ? buyerId : sellerId,
      receiverId: i % 2 === 0 ? sellerId : buyerId,
      listingId,
      content: rand(MESSAGE_TEMPLATES).replace("${price}", `$${randInt(10, 200)}`),
      isRead: Math.random() > 0.3,
      createdAt: daysAgo(msgAge),
    });
    msgCount++;
  }
  console.log(`  Created ${msgCount} messages`);

  console.log("Creating favorites...");
  let favCount = 0;
  const favSet = new Set<string>();
  for (let i = 0; i < 500; i++) {
    const userId = rand(userIds);
    const listingId = rand(listingIds);
    const key = `${userId}-${listingId}`;
    if (favSet.has(key)) continue;
    if (listingUserMap[listingId] === userId) continue;
    favSet.add(key);
    await db.insert(favorites).values({
      userId,
      listingId,
      createdAt: daysAgo(randInt(0, 60)),
    });
    favCount++;
  }
  console.log(`  Created ${favCount} favorites`);

  console.log("Creating reviews...");
  let revCount = 0;
  const reviewSet = new Set<string>();
  for (let i = 0; i < 150; i++) {
    const listingId = rand(listingIds);
    const sellerId = listingUserMap[listingId];
    let reviewerId = rand(userIds);
    while (reviewerId === sellerId) reviewerId = rand(userIds);
    const key = `${reviewerId}-${sellerId}`;
    if (reviewSet.has(key)) continue;
    reviewSet.add(key);
    const rating = randInt(3, 5);
    const hasReply = Math.random() > 0.6;

    await db.insert(reviews).values({
      listingId,
      reviewerId,
      sellerId,
      rating,
      comment: rand(REVIEW_COMMENTS),
      sellerReply: hasReply ? rand(["Thank you so much!", "Glad you're happy with it!", "Thanks for the great review!", "Enjoy! Come back anytime."]) : null,
      sellerReplyAt: hasReply ? daysAgo(randInt(0, 10)) : null,
      createdAt: daysAgo(randInt(1, 60)),
    });
    revCount++;
  }
  console.log(`  Created ${revCount} reviews`);

  console.log("Creating events...");
  let eventCount = 0;
  const eventIds: number[] = [];
  for (let i = 0; i < 15; i++) {
    const userId = userIds[randInt(0, 99)];
    const loc = rand(CITIES);
    const startDays = randInt(-5, 30);
    const startDate = startDays < 0 ? daysAgo(Math.abs(startDays)) : daysFromNow(startDays);
    const endDate = new Date(startDate);
    endDate.setHours(endDate.getHours() + randInt(4, 8));

    const [ev] = await db.insert(events).values({
      userId,
      title: rand(EVENT_TITLES),
      description: rand([
        "Join us for amazing deals on pre-loved items! Multiple families participating. Cash and electronic payments accepted.",
        "Huge community sale with furniture, clothing, toys, books, and more. Something for everyone! Don't miss out on incredible bargains.",
        "Clearing out the house — everything must go! Great prices on quality items. Early birds welcome, no holds.",
        "Annual neighborhood yard sale event. Dozens of families selling from their front yards. Maps available at entrance.",
        "Pop-up market featuring vintage finds, handmade crafts, and gently used treasures. Free parking and refreshments available.",
      ]),
      address: `${randInt(100, 9999)} ${rand(["Oak", "Elm", "Pine"])} ${rand(["St", "Ave", "Dr"])}`,
      city: loc.city,
      country: loc.country,
      startDate,
      endDate,
      photos: rand(EVENT_PHOTOS),
      isNeighborhood: Math.random() > 0.5,
      maxParticipants: randInt(0, 50),
      createdAt: daysAgo(randInt(5, 45)),
    }).returning();

    if (ev) {
      eventIds.push(ev.id);
      eventCount++;
    }
  }

  for (let i = 0; i < 60; i++) {
    if (eventIds.length === 0) break;
    await db.insert(eventRsvps).values({
      eventId: rand(eventIds),
      userId: rand(userIds),
      createdAt: daysAgo(randInt(0, 20)),
    }).onConflictDoNothing();
  }
  console.log(`  Created ${eventCount} events with RSVPs`);

  console.log("Creating offers...");
  let offerCount = 0;
  const offerIds: number[] = [];
  const offerData: Array<{ id: number; listingId: number; buyerId: string; sellerId: string; amount: number }> = [];
  for (let i = 0; i < 80; i++) {
    const listingId = rand(listingIds);
    const sellerId = listingUserMap[listingId];
    let buyerId = rand(userIds);
    while (buyerId === sellerId) buyerId = rand(userIds);
    const amount = randInt(500, 50000);
    const statuses = ["pending", "accepted", "rejected", "countered"];
    const status = rand(statuses);

    const [off] = await db.insert(offers).values({
      listingId,
      buyerId,
      sellerId,
      amount,
      currency: "USD",
      status,
      counterAmount: status === "countered" ? amount + randInt(200, 5000) : null,
      message: rand(["Is this still available?", "Would love to buy this!", "Can we negotiate?", "Fair price?", null]),
      createdAt: daysAgo(randInt(1, 45)),
      updatedAt: daysAgo(randInt(0, 5)),
    }).returning();

    if (off) {
      offerIds.push(off.id);
      offerData.push({ id: off.id, listingId, buyerId, sellerId, amount });
      offerCount++;
    }
  }
  console.log(`  Created ${offerCount} offers`);

  console.log("Creating orders...");
  let orderCount = 0;
  const acceptedOffers = offerData.slice(0, 25);
  for (const offer of acceptedOffers) {
    const statusOpts = ["pending", "paid", "shipped", "delivered"];
    const status = rand(statusOpts);

    await db.insert(orders).values({
      listingId: offer.listingId,
      buyerId: offer.buyerId,
      sellerId: offer.sellerId,
      offerId: offer.id,
      amount: offer.amount,
      currency: "USD",
      shippingAddress: status !== "pending" ? `${randInt(100, 9999)} Delivery St, Some City` : null,
      trackingNumber: status === "shipped" || status === "delivered" ? `TRK${randInt(100000, 999999)}` : null,
      trackingCarrier: status === "shipped" || status === "delivered" ? rand(["UPS", "USPS", "FedEx", "DHL"]) : null,
      status,
      createdAt: daysAgo(randInt(1, 30)),
      updatedAt: daysAgo(randInt(0, 5)),
    });
    orderCount++;
  }
  console.log(`  Created ${orderCount} orders`);

  console.log("Creating referrals...");
  for (let i = 0; i < 30; i++) {
    const referrerIdx = randInt(0, 99);
    let referredIdx = randInt(0, 99);
    while (referredIdx === referrerIdx) referredIdx = randInt(0, 99);

    await db.insert(referrals).values({
      referrerId: userIds[referrerIdx],
      referredUserId: userIds[referredIdx],
      referralCode: `REF${String(referrerIdx + 1).padStart(4, "0")}`,
      boostCredits: randInt(1, 5),
      status: rand(["pending", "completed"]),
      createdAt: daysAgo(randInt(5, 90)),
    }).onConflictDoNothing();
  }
  console.log("  Created referrals");

  console.log("Creating listing analytics...");
  let analyticsCount = 0;
  for (const listingId of listingIds.slice(0, 100)) {
    const numViews = randInt(3, 30);
    for (let v = 0; v < numViews; v++) {
      await db.insert(listingAnalytics).values({
        listingId,
        source: rand(["direct", "search", "category", "featured", "share", null]),
        createdAt: daysAgo(randInt(0, 30)),
      });
      analyticsCount++;
    }
  }
  console.log(`  Created ${analyticsCount} analytics events`);

  console.log("Creating notifications...");
  let notifCount = 0;
  for (let i = 0; i < 200; i++) {
    const userId = rand(userIds);
    const types = ["message", "offer", "boost_expiry", "review", "report_resolved"];
    const type = rand(types);
    const titles: Record<string, string> = {
      message: "New message received",
      offer: "New offer on your listing",
      boost_expiry: "Your boost is expiring soon",
      review: "New review on your profile",
      report_resolved: "Your report has been resolved",
    };
    const bodies: Record<string, string> = {
      message: "Someone sent you a message about your listing.",
      offer: "You received a new offer. Check it out!",
      boost_expiry: "Your listing boost expires in 2 days. Renew to keep the visibility.",
      review: "A buyer left a review about their experience.",
      report_resolved: "The report you submitted has been reviewed by our team.",
    };

    await db.insert(notifications).values({
      userId,
      type,
      title: titles[type],
      body: bodies[type],
      link: type === "message" ? "/messages" : type === "offer" ? "/offers" : type === "review" ? `/seller/${userId}` : "/",
      isRead: Math.random() > 0.4,
      createdAt: daysAgo(randInt(0, 30)),
    });
    notifCount++;
  }
  console.log(`  Created ${notifCount} notifications`);

  console.log("Creating saved searches...");
  for (let i = 0; i < 40; i++) {
    const userId = rand(userIds);
    const categories = ["Furniture", "Electronics", "Clothing", "Books", "Vintage"];
    const cat = rand(categories);
    const loc = rand(CITIES);

    await db.insert(savedSearches).values({
      userId,
      label: `${cat} in ${loc.city}`,
      query: { category: cat, city: loc.city, country: loc.country },
      createdAt: daysAgo(randInt(1, 45)),
    });
  }
  console.log("  Created saved searches");

  console.log("Creating reports...");
  for (let i = 0; i < 15; i++) {
    const listingId = rand(listingIds);
    let reporterId = rand(userIds);
    while (reporterId === listingUserMap[listingId]) reporterId = rand(userIds);

    await db.insert(reports).values({
      listingId,
      reporterId,
      reason: rand(["Spam or scam", "Offensive content", "Incorrect category", "Item already sold", "Duplicate listing"]),
      details: rand(["This listing seems suspicious", "I believe this has already been sold", "Wrong category for this item", null]),
      status: rand(["pending", "resolved", "dismissed"]),
      adminResponse: Math.random() > 0.5 ? "Thank you for your report. We've reviewed this listing." : null,
      createdAt: daysAgo(randInt(1, 30)),
    });
  }
  console.log("  Created reports");

  console.log("\n=== SEED COMPLETE ===");
  console.log(`  100 users`);
  console.log(`  ${listingIds.length} listings (individual + yard sales + shops)`);
  console.log(`  ${msgCount} messages`);
  console.log(`  ${favCount} favorites`);
  console.log(`  ${revCount} reviews`);
  console.log(`  ${eventCount} events`);
  console.log(`  ${offerCount} offers`);
  console.log(`  ${orderCount} orders`);
  console.log(`  ${analyticsCount} analytics events`);
  console.log(`  ${notifCount} notifications`);
  console.log(`  + referrals, saved searches, reports`);
  console.log("\nYou can log in as any seed user (user1@yardees-demo.com through user100@yardees-demo.com)");
  console.log("Note: Seed users have auth_type='seed' and no password. Use the app's regular auth to interact.\n");
}

seed().catch(console.error).then(() => process.exit(0));
