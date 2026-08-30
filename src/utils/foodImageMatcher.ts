/**
 * Comprehensive Culinary & Food Photography Resolver for DZPOS Menu System
 * Provides high-quality, matched Unsplash food photography based on dish titles,
 * categories, ingredients, and keywords across Arabic, French, and English.
 */

export interface FoodImageMapping {
  keywords: string[];
  url: string;
  category: string;
  fallbackEmoji: string;
}

export const CULINARY_IMAGE_DATABASE: FoodImageMapping[] = [
  // ==========================================
  // 1. CHICKEN & POULTRY (دجاج، أجنحة، طاووق، كريسبي)
  // ==========================================
  {
    keywords: ['أجنحة', 'اجنحة', 'wings', 'buffalo', 'ailes de poulet', 'chicken wings'],
    url: 'https://images.unsplash.com/photo-1567620832903-9fc6debc209f?w=700&auto=format&fit=crop&q=80',
    category: 'chicken',
    fallbackEmoji: '🍗'
  },
  {
    keywords: ['كريسبي', 'دجاج مقلي', 'تندرز', 'ناغتس', 'nuggets', 'crispy', 'fried chicken', 'tenders', 'strips'],
    url: 'https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?w=700&auto=format&fit=crop&q=80',
    category: 'chicken',
    fallbackEmoji: '🍗'
  },
  {
    keywords: ['طاووق', 'شيش طاووق', 'brochette poulet', 'taouk', 'shish taouk', 'شواية', 'دجاج محمر', 'poulet roti', 'roast chicken'],
    url: 'https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?w=700&auto=format&fit=crop&q=80',
    category: 'chicken',
    fallbackEmoji: '🍗'
  },
  {
    keywords: ['كوردون بلو', 'cordon bleu', 'escalope', 'اسكالوب', 'ستيك دجاج'],
    url: 'https://images.unsplash.com/photo-1632778149955-e80f8ceca2e8?w=700&auto=format&fit=crop&q=80',
    category: 'chicken',
    fallbackEmoji: '🍗'
  },
  {
    keywords: ['شاورما دجاج', 'shawarma poulet', 'chicken shawarma'],
    url: 'https://images.unsplash.com/photo-1644704170910-a0cdf183649b?w=700&auto=format&fit=crop&q=80',
    category: 'chicken',
    fallbackEmoji: '🌯'
  },
  {
    keywords: ['دجاج', 'poulet', 'chicken', 'دجاجه'],
    url: 'https://images.unsplash.com/photo-1532550907401-a500c9a57435?w=700&auto=format&fit=crop&q=80',
    category: 'chicken',
    fallbackEmoji: '🍗'
  },

  // ==========================================
  // 2. MEATS, GRILLS & BBQ (مشاوي ولحوم، كفتة، كباب، ستيك)
  // ==========================================
  {
    keywords: ['مشاوي مشكلة', 'مشكل مشاوي', 'mix grill', 'grillade mixte', 'صحن مشاوي'],
    url: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=700&auto=format&fit=crop&q=80',
    category: 'grill',
    fallbackEmoji: '🥩'
  },
  {
    keywords: ['كفتة', 'كباب', 'kefta', 'kebab', 'brochette kefta', 'مفروم'],
    url: 'https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?w=700&auto=format&fit=crop&q=80',
    category: 'grill',
    fallbackEmoji: '🥩'
  },
  {
    keywords: ['ستيك', 'انتركوت', 'لحم بقر', 'ribeye', 'steak', 'entrecote', 'beef'],
    url: 'https://images.unsplash.com/photo-1600891964599-f61ba0e24092?w=700&auto=format&fit=crop&q=80',
    category: 'grill',
    fallbackEmoji: '🥩'
  },
  {
    keywords: ['ريش', 'كوتليت', 'لحم غنم', 'cotelettes', 'lamb chops', 'agneau'],
    url: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=700&auto=format&fit=crop&q=80',
    category: 'grill',
    fallbackEmoji: '🥩'
  },
  {
    keywords: ['مرقاز', 'merguez', 'نقانق', 'sausage'],
    url: 'https://images.unsplash.com/photo-1585238342024-78d387f4a707?w=700&auto=format&fit=crop&q=80',
    category: 'grill',
    fallbackEmoji: '🌭'
  },
  {
    keywords: ['شاورما لحم', 'shawarma viande', 'beef shawarma', 'شاورما'],
    url: 'https://images.unsplash.com/photo-1561651823-34feb02250e4?w=700&auto=format&fit=crop&q=80',
    category: 'grill',
    fallbackEmoji: '🌯'
  },
  {
    keywords: ['مشاوي', 'شواء', 'grill', 'viande', 'لحم'],
    url: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=700&auto=format&fit=crop&q=80',
    category: 'grill',
    fallbackEmoji: '🥩'
  },

  // ==========================================
  // 3. BURGERS & SANDWICHES (برغر، طاكوس، بانيني، ساندويتش)
  // ==========================================
  {
    keywords: ['برغر بيف', 'دبل برغر', 'burger royal', 'double beef', 'cheeseburger', 'برغر الباهية', 'همبرجر', 'همبرغر'],
    url: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=700&auto=format&fit=crop&q=80',
    category: 'burger',
    fallbackEmoji: '🍔'
  },
  {
    keywords: ['برغر دجاج', 'chicken burger', 'burger poulet'],
    url: 'https://images.unsplash.com/photo-1615297928064-24977384d0ec?w=700&auto=format&fit=crop&q=80',
    category: 'burger',
    fallbackEmoji: '🍔'
  },
  {
    keywords: ['برغر', 'burger'],
    url: 'https://images.unsplash.com/photo-1550547660-d9450f859349?w=700&auto=format&fit=crop&q=80',
    category: 'burger',
    fallbackEmoji: '🍔'
  },
  {
    keywords: ['طاكوس', 'تاكوس', 'tacos', 'tacos xxl', 'tacos lyonnais'],
    url: 'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=700&auto=format&fit=crop&q=80',
    category: 'tacos',
    fallbackEmoji: '🌮'
  },
  {
    keywords: ['بانيني', 'panini', 'سندويش محمص'],
    url: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=700&auto=format&fit=crop&q=80',
    category: 'sandwich',
    fallbackEmoji: '🥪'
  },
  {
    keywords: ['ساندويتش تونة', 'baguette thon', 'sandwich thon', 'تونة'],
    url: 'https://images.unsplash.com/photo-1509722747041-616f39b57569?w=700&auto=format&fit=crop&q=80',
    category: 'sandwich',
    fallbackEmoji: '🥪'
  },
  {
    keywords: ['كلوب ساندويتش', 'ساندويتش جبن', 'club sandwich', 'sandwich fromage', 'ساندويتش', 'سندويتش'],
    url: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=700&auto=format&fit=crop&q=80',
    category: 'sandwich',
    fallbackEmoji: '🥪'
  },
  {
    keywords: ['بطاطا', 'بطاطس', 'فريت', 'frites', 'fries', 'french fries'],
    url: 'https://images.unsplash.com/photo-1576107232684-1279f3908594?w=700&auto=format&fit=crop&q=80',
    category: 'sides',
    fallbackEmoji: '🍟'
  },

  // ==========================================
  // 4. PIZZA & PASTA (بيتزا، باستا، معكرونة)
  // ==========================================
  {
    keywords: ['بيتزا بيبروني', 'pizza pepperoni', 'pizza spicy'],
    url: 'https://images.unsplash.com/photo-1628840042765-356cda07504e?w=700&auto=format&fit=crop&q=80',
    category: 'pizza',
    fallbackEmoji: '🍕'
  },
  {
    keywords: ['بيتزا مارغريتا', 'بيتزا فورماج', 'pizza margherita', 'pizza 4 fromages', 'pizza fromage'],
    url: 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=700&auto=format&fit=crop&q=80',
    category: 'pizza',
    fallbackEmoji: '🍕'
  },
  {
    keywords: ['بيتزا دجاج', 'بيتزا ميكس', 'pizza poulet', 'pizza viande', 'بيتزا', 'pizza'],
    url: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=700&auto=format&fit=crop&q=80',
    category: 'pizza',
    fallbackEmoji: '🍕'
  },
  {
    keywords: ['سباغيتي', 'باستا', 'معكرونة', 'spaghetti', 'pasta', 'pates', 'bolognaise'],
    url: 'https://images.unsplash.com/photo-1621996346565-e3d5d6281541?w=700&auto=format&fit=crop&q=80',
    category: 'pasta',
    fallbackEmoji: '🍝'
  },
  {
    keywords: ['لازانيا', 'lasagne', 'lasagna'],
    url: 'https://images.unsplash.com/photo-1574894709920-11b28e7367e3?w=700&auto=format&fit=crop&q=80',
    category: 'pasta',
    fallbackEmoji: '🥘'
  },

  // ==========================================
  // 5. TRADITIONAL ARABIC & ALGERIAN DISHES (أطباق تقليدية، طواجن، كسكس)
  // ==========================================
  {
    keywords: ['طاجين الزيتون', 'طاجين زيتون', 'tajine olive', 'tajine olives'],
    url: 'https://images.unsplash.com/photo-1541544741938-0af808871cc0?w=700&auto=format&fit=crop&q=80',
    category: 'traditional',
    fallbackEmoji: '🍲'
  },
  {
    keywords: ['كسكسي', 'كسكس', 'بربوشة', 'couscous', 'طعام'],
    url: 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=700&auto=format&fit=crop&q=80',
    category: 'traditional',
    fallbackEmoji: '🍲'
  },
  {
    keywords: ['شربة', 'حريرة', 'شربة فريك', 'شوربة', 'chorba', 'harira', 'soup', 'soupe'],
    url: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=700&auto=format&fit=crop&q=80',
    category: 'traditional',
    fallbackEmoji: '🥣'
  },
  {
    keywords: ['طاجين', 'tajine', 'طواجن'],
    url: 'https://images.unsplash.com/photo-1511690656952-34342bb7c2f2?w=700&auto=format&fit=crop&q=80',
    category: 'traditional',
    fallbackEmoji: '🍲'
  },
  {
    keywords: ['شكشوكة', 'chouchouka', 'shakshuka'],
    url: 'https://images.unsplash.com/photo-1590412200988-a436970781fa?w=700&auto=format&fit=crop&q=80',
    category: 'traditional',
    fallbackEmoji: '🍳'
  },
  {
    keywords: ['بوراك', 'بريك', 'bourek', 'brik'],
    url: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=700&auto=format&fit=crop&q=80',
    category: 'traditional',
    fallbackEmoji: '🥟'
  },
  {
    keywords: ['سمك', 'حوت', 'دوراد', 'سردين', 'fish', 'poisson', 'saumon', 'crevettes', 'جمبري'],
    url: 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=700&auto=format&fit=crop&q=80',
    category: 'seafood',
    fallbackEmoji: '🐟'
  },

  // ==========================================
  // 6. SALADS & HEALTHY (سلطات ومقبلات)
  // ==========================================
  {
    keywords: ['سلطة سيزر', 'caesar salad', 'salade cesar'],
    url: 'https://images.unsplash.com/photo-1550304943-4f24f54ddde9?w=700&auto=format&fit=crop&q=80',
    category: 'salad',
    fallbackEmoji: '🥗'
  },
  {
    keywords: ['سلطة تونة', 'salade thon', 'salade nicoise'],
    url: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=700&auto=format&fit=crop&q=80',
    category: 'salad',
    fallbackEmoji: '🥗'
  },
  {
    keywords: ['سلطة', 'salade', 'salad', 'خضار'],
    url: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=700&auto=format&fit=crop&q=80',
    category: 'salad',
    fallbackEmoji: '🥗'
  },

  // ==========================================
  // 7. DESSERTS, SWEETS & ICE CREAM (حلويات، كريب، آيس كريم، كيك)
  // ==========================================
  {
    keywords: ['تشيز كيك', 'cheesecake', 'cheese cake'],
    url: 'https://images.unsplash.com/photo-1533134242443-d4fd215305ad?w=700&auto=format&fit=crop&q=80',
    category: 'dessert',
    fallbackEmoji: '🍰'
  },
  {
    keywords: ['تيراميسو', 'tiramisu'],
    url: 'https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?w=700&auto=format&fit=crop&q=80',
    category: 'dessert',
    fallbackEmoji: '🍰'
  },
  {
    keywords: ['كريب', 'وافل', 'crepe', 'gaufre', 'waffle', 'pancake', 'بانكيك'],
    url: 'https://images.unsplash.com/photo-1519676867240-f03562e64548?w=700&auto=format&fit=crop&q=80',
    category: 'dessert',
    fallbackEmoji: '🥞'
  },
  {
    keywords: ['فوندان', 'كيك شوكولا', 'fondant', 'cake chocolat', 'كعكة', 'براونيز', 'brownie'],
    url: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=700&auto=format&fit=crop&q=80',
    category: 'dessert',
    fallbackEmoji: '🍫'
  },
  {
    keywords: ['آيس كريم', 'مثلجات', 'قلاص', 'glace', 'ice cream', 'gelato'],
    url: 'https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=700&auto=format&fit=crop&q=80',
    category: 'dessert',
    fallbackEmoji: '🍨'
  },
  {
    keywords: ['بقلاوة', 'قلب اللوز', 'حلويات تقليدية', 'baklava', 'makroud', 'مقروط'],
    url: 'https://images.unsplash.com/photo-1519869325930-281384150729?w=700&auto=format&fit=crop&q=80',
    category: 'dessert',
    fallbackEmoji: '🍯'
  },
  {
    keywords: ['حلوى', 'حلويات', 'كيك', 'dessert', 'gateau', 'cake', 'sweet'],
    url: 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=700&auto=format&fit=crop&q=80',
    category: 'dessert',
    fallbackEmoji: '🍰'
  },

  // ==========================================
  // 8. DRINKS, JUICES & COFFEE (عصائر، مشروبات، قهوة، شاي)
  // ==========================================
  {
    keywords: ['عصير برتقال', 'عصير ليمون', 'ليموناضة', 'jus orange', 'citronnade', 'orange juice', 'lemonade'],
    url: 'https://images.unsplash.com/photo-1613478223719-2ab802602423?w=700&auto=format&fit=crop&q=80',
    category: 'drinks',
    fallbackEmoji: '🍊'
  },
  {
    keywords: ['عصير فراولة', 'سموذي', 'كوكتيل', 'smoothie', 'jus fraise', 'cocktail', 'cocktail fruits'],
    url: 'https://images.unsplash.com/photo-1553530666-ba11a7da3888?w=700&auto=format&fit=crop&q=80',
    category: 'drinks',
    fallbackEmoji: '🍹'
  },
  {
    keywords: ['موخيتو', 'موهيتو', 'mojito'],
    url: 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=700&auto=format&fit=crop&q=80',
    category: 'drinks',
    fallbackEmoji: '🍸'
  },
  {
    keywords: ['حمود', 'سيليكتو', 'كوكا', 'بيبسي', 'مشروب غازي', 'كانيت', 'selecto', 'coca', 'pepsi', 'soda', 'canette', 'gazéifiée'],
    url: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=700&auto=format&fit=crop&q=80',
    category: 'drinks',
    fallbackEmoji: '🥤'
  },
  {
    keywords: ['قهوة', 'اسبريسو', 'espresso', 'cafe', 'coffee', 'كابوتشينو', 'لاتيه', 'cappuccino', 'latte'],
    url: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=700&auto=format&fit=crop&q=80',
    category: 'drinks',
    fallbackEmoji: '☕'
  },
  {
    keywords: ['شاي', 'اتاي', 'tea', 'the vert', 'the a la menthe'],
    url: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=700&auto=format&fit=crop&q=80',
    category: 'drinks',
    fallbackEmoji: '🍵'
  },
  {
    keywords: ['ماء', 'ماء معدني', 'eau', 'eau minerale', 'water'],
    url: 'https://images.unsplash.com/photo-1559839914-17aae19cec71?w=700&auto=format&fit=crop&q=80',
    category: 'drinks',
    fallbackEmoji: '💧'
  },
  {
    keywords: ['عصير', 'jus', 'juice', 'مشروب', 'boisson', 'drink'],
    url: 'https://images.unsplash.com/photo-1534353473418-4cfa6c56fd38?w=700&auto=format&fit=crop&q=80',
    category: 'drinks',
    fallbackEmoji: '🥤'
  }
];

/**
 * Default fallback image when nothing matches (a beautiful restaurant dish)
 */
export const RESTAURANT_INTERIOR_COVERS = [
  // 1. Warm Modern Dining Room with Pendant Lights (just like user's sample)
  'https://images.unsplash.com/photo-1550966871-3ed3cdb5ed0c?w=1200&auto=format&fit=crop&q=80',
  // 2. High-end Luxury Restaurant & Bar with Atmospheric Lighting
  'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1200&auto=format&fit=crop&q=80',
  // 3. Cozy Steakhouse & Grill Dining Lounge
  'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=1200&auto=format&fit=crop&q=80',
  // 4. Velvet & Wood Fine Dining Hall
  'https://images.unsplash.com/photo-1559339352-11d035aa65de?w=1200&auto=format&fit=crop&q=80',
  // 5. Chic Bistro with Warm Ambient Chandeliers
  'https://images.unsplash.com/photo-1543007630-9710e4a00a20?w=1200&auto=format&fit=crop&q=80',
  // 6. Modern Oriental & Traditional Restaurant Interior
  'https://images.unsplash.com/photo-1578474846511-04ba529f0b88?w=1200&auto=format&fit=crop&q=80',
  // 7. Contemporary Coffee & Dining Lounge
  'https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=1200&auto=format&fit=crop&q=80',
  // 8. Elegant Italian Pizzeria & Wine Bar
  'https://images.unsplash.com/photo-1537047902294-62a40c20a6ae?w=1200&auto=format&fit=crop&q=80',
  // 9. Modern Industrial Dining Space
  'https://images.unsplash.com/photo-1590846406792-0adc7f938f1d?w=1200&auto=format&fit=crop&q=80',
  // 10. Warm Wooden Tables and Cozy Atmosphere
  'https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=1200&auto=format&fit=crop&q=80'
];

export const RESTAURANT_THUMBNAIL_LOGOS = [
  'https://images.unsplash.com/photo-1550966871-3ed3cdb5ed0c?w=300&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=300&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=300&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1559339352-11d035aa65de?w=300&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1578474846511-04ba529f0b88?w=300&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1543007630-9710e4a00a20?w=300&auto=format&fit=crop&q=80'
];

/**
 * Deterministically pick or randomly pick a restaurant interior image based on a seed or restaurant name
 */
export function getRestaurantCoverImage(customUrl?: string, seed?: string): string {
  if (customUrl && typeof customUrl === 'string' && customUrl.trim() && !customUrl.includes('placeholder')) {
    const clean = customUrl.trim();
    if (clean.startsWith('http://') || clean.startsWith('https://') || clean.startsWith('/')) {
      return clean;
    }
  }

  if (!seed) {
    return RESTAURANT_INTERIOR_COVERS[0];
  }

  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % RESTAURANT_INTERIOR_COVERS.length;
  return RESTAURANT_INTERIOR_COVERS[index];
}

/**
 * Deterministically pick or randomly pick a restaurant logo/interior thumbnail
 */
export function getRestaurantLogoImage(customUrl?: string, seed?: string): string {
  if (customUrl && typeof customUrl === 'string' && customUrl.trim() && !customUrl.includes('placeholder')) {
    const clean = customUrl.trim();
    if (clean.startsWith('http://') || clean.startsWith('https://') || clean.startsWith('/')) {
      return clean;
    }
  }

  if (!seed) {
    return RESTAURANT_THUMBNAIL_LOGOS[0];
  }

  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % RESTAURANT_THUMBNAIL_LOGOS.length;
  return RESTAURANT_THUMBNAIL_LOGOS[index];
}

export const DEFAULT_CULINARY_IMAGE = 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=700&auto=format&fit=crop&q=80';

/**
 * Finds the closest matching internet food photography for a dish name / category
 */
export function getMatchedFoodImageUrl(dishName?: string, categoryName?: string): string {
  const text = `${dishName || ''} ${categoryName || ''}`.toLowerCase().trim();
  if (!text) return DEFAULT_CULINARY_IMAGE;

  // 1. Precise multi-word scoring
  let bestMatch: FoodImageMapping | null = null;
  let highestScore = 0;

  for (const item of CULINARY_IMAGE_DATABASE) {
    let score = 0;
    for (const kw of item.keywords) {
      const lowerKw = kw.toLowerCase();
      if (text === lowerKw) {
        score += 20; // Exact match
      } else if (text.includes(lowerKw)) {
        // Longer keywords give higher match fidelity
        score += lowerKw.length > 5 ? 10 : 5;
      }
    }

    if (score > highestScore) {
      highestScore = score;
      bestMatch = item;
    }
  }

  if (bestMatch && highestScore > 0) {
    return bestMatch.url;
  }

  // 2. Generic Category Fallbacks
  if (text.includes('مشاوي') || text.includes('لحم') || text.includes('grill') || text.includes('viande')) {
    return 'https://images.unsplash.com/photo-1544025162-d76694265947?w=700&auto=format&fit=crop&q=80';
  }
  if (text.includes('دجاج') || text.includes('poulet') || text.includes('chicken')) {
    return 'https://images.unsplash.com/photo-1532550907401-a500c9a57435?w=700&auto=format&fit=crop&q=80';
  }
  if (text.includes('ساندويتش') || text.includes('sandwich') || text.includes('برغر') || text.includes('burger')) {
    return 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=700&auto=format&fit=crop&q=80';
  }
  if (text.includes('بيتزا') || text.includes('pizza')) {
    return 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=700&auto=format&fit=crop&q=80';
  }
  if (text.includes('مشروب') || text.includes('عصير') || text.includes('boisson') || text.includes('drink')) {
    return 'https://images.unsplash.com/photo-1613478223719-2ab802602423?w=700&auto=format&fit=crop&q=80';
  }
  if (text.includes('حلوى') || text.includes('dessert') || text.includes('gateau')) {
    return 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=700&auto=format&fit=crop&q=80';
  }

  return DEFAULT_CULINARY_IMAGE;
}

/**
 * Returns a guaranteed valid image URL for any menu product.
 * If the provided imageUrl is empty, a broken placeholder, or fails,
 * it returns the closely matching internet photo from Unsplash.
 */
export function resolveDishImageWithFallback(
  rawUrl?: string,
  dishName?: string,
  categoryName?: string
): string {
  if (rawUrl && typeof rawUrl === 'string') {
    const clean = rawUrl.trim();
    // If it's already a full web URL (unsplash, https, etc.) or data URL, return it
    if (clean.startsWith('http://') || clean.startsWith('https://') || clean.startsWith('data:')) {
      return clean;
    }
    // If it's a local storage path that starts with /, return it (backend will serve or fallback)
    if (clean.startsWith('/')) {
      return clean;
    }
  }

  // Otherwise, lookup matching high-definition internet photo
  return getMatchedFoodImageUrl(dishName, categoryName);
}
