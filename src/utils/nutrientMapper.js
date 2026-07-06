const CANONICAL_KEYS = {
    // ===============================
    // Energy & Main Macros
    // ===============================
    CALORIES: 'calories',
    PROTEIN: 'protein',
    CARBS: 'carbs',
    FAT: 'fat',
    FIBER: 'fiber',
    SUGAR: 'sugar',
    ADDED_SUGAR: 'addedSugar',
    SATURATED_FAT: 'saturatedFat',
    TRANS_FAT: 'transFat',
    CHOLESTEROL: 'cholesterol',
    SODIUM: 'sodium',
    WATER: 'waterVolume',

    // ===============================
    // Secondary Fats & Carbs
    // ===============================
    STARCH: 'starch',
    MONOUNSATURATED_FAT: 'monounsaturatedFat',
    POLYUNSATURATED_FAT: 'polyunsaturatedFat',
    OMEGA_3: 'omega3',
    OMEGA_6: 'omega6',

    // ===============================
    // Minerals
    // ===============================
    CALCIUM: 'calcium',
    IRON: 'iron',
    MAGNESIUM: 'magnesium',
    PHOSPHORUS: 'phosphorus',
    POTASSIUM: 'potassium',
    ZINC: 'zinc',
    COPPER: 'copper',
    MANGANESE: 'manganese',
    SELENIUM: 'selenium',
    IODINE: 'iodine',
    CHLORIDE: 'chloride',
    CHROMIUM: 'chromium',
    MOLYBDENUM: 'molybdenum',

    // ===============================
    // Vitamins
    // ===============================
    VITAMIN_A: 'vitaminA',
    VITAMIN_B1: 'vitaminB1',
    VITAMIN_B2: 'vitaminB2',
    VITAMIN_B3: 'vitaminB3',
    VITAMIN_B5: 'vitaminB5',
    VITAMIN_B6: 'vitaminB6',
    VITAMIN_B7: 'vitaminB7',
    VITAMIN_B9: 'vitaminB9',
    VITAMIN_B12: 'vitaminB12',
    VITAMIN_C: 'vitaminC',
    VITAMIN_D: 'vitaminD',
    VITAMIN_E: 'vitaminE',
    VITAMIN_K: 'vitaminK',
    VITAMIN_D2: 'vitaminD2',
    VITAMIN_D3: 'vitaminD3',

    // ===============================
    // Amino Acids
    // ===============================
    TRYPTOPHAN: 'tryptophan',
    THREONINE: 'threonine',
    ISOLEUCINE: 'isoleucine',
    LEUCINE: 'leucine',
    LYSINE: 'lysine',
    METHIONINE: 'methionine',
    CYSTINE: 'cystine',
    PHENYLALANINE: 'phenylalanine',
    TYROSINE: 'tyrosine',
    VALINE: 'valine',
    ARGININE: 'arginine',
    HISTIDINE: 'histidine',
    ALANINE: 'alanine',
    ASPARTIC_ACID: 'asparticAcid',
    GLUTAMIC_ACID: 'glutamicAcid',
    GLYCINE: 'glycine',
    PROLINE: 'proline',
    SERINE: 'serine',

    // ===============================
    // Other Compounds
    // ===============================
    CAFFEINE: 'caffeine',
    TAURINE: 'taurine',
    ALCOHOL: 'alcohol',
    ASH: 'ash',
    CHOLINE: 'choline',
    FLUORIDE: 'fluoride',
    LUTEIN: 'lutein',
    ZEAXANTHIN: 'zeaxanthin',
    LYCOPENE: 'lycopene',
    BETA_CAROTENE: 'betaCarotene',
    ALPHA_CAROTENE: 'alphaCarotene',
    BETA_CRYPTOXANTHIN: 'betaCryptoxanthin',
    RETINOL: 'retinol'
};

// These go into the primary `nutrients` map
const MAIN_NUTRIENT_LIST = [
    CANONICAL_KEYS.CALORIES, CANONICAL_KEYS.PROTEIN, CANONICAL_KEYS.CARBS, 
    CANONICAL_KEYS.FAT, CANONICAL_KEYS.FIBER, CANONICAL_KEYS.SUGAR, 
    CANONICAL_KEYS.ADDED_SUGAR, CANONICAL_KEYS.SATURATED_FAT, 
    CANONICAL_KEYS.TRANS_FAT, CANONICAL_KEYS.CHOLESTEROL, 
    CANONICAL_KEYS.SODIUM, CANONICAL_KEYS.WATER
];

// Handles typos, alternative spellings, and standard abbreviations
const SYNONYM_MAP = {
    'kcal': CANONICAL_KEYS.CALORIES,
    'energy': CANONICAL_KEYS.CALORIES,
    
    'carbohydrates': CANONICAL_KEYS.CARBS,
    'total carbs': CANONICAL_KEYS.CARBS,
    
    'sugars': CANONICAL_KEYS.SUGAR,
    'total sugar': CANONICAL_KEYS.SUGAR,
    'added sugars': CANONICAL_KEYS.ADDED_SUGAR,
    
    'fibre': CANONICAL_KEYS.FIBER,
    'dietary fiber': CANONICAL_KEYS.FIBER,
    
    'sat fat': CANONICAL_KEYS.SATURATED_FAT,
    'saturatedfat': CANONICAL_KEYS.SATURATED_FAT,
    
    'poly fat': CANONICAL_KEYS.POLYUNSATURATED_FAT,
    'mono fat': CANONICAL_KEYS.MONOUNSATURATED_FAT,
    
    'na': CANONICAL_KEYS.SODIUM,
    'salt': CANONICAL_KEYS.SODIUM,
    
    'vit a': CANONICAL_KEYS.VITAMIN_A,
    'vit c': CANONICAL_KEYS.VITAMIN_C,
    'ascorbic acid': CANONICAL_KEYS.VITAMIN_C,
    'vit d': CANONICAL_KEYS.VITAMIN_D,
    'vit e': CANONICAL_KEYS.VITAMIN_E,
    'vit k': CANONICAL_KEYS.VITAMIN_K,
    
    'thiamine': CANONICAL_KEYS.VITAMIN_B1,
    'riboflavin': CANONICAL_KEYS.VITAMIN_B2,
    'niacin': CANONICAL_KEYS.VITAMIN_B3,
    'pantothenic acid': CANONICAL_KEYS.VITAMIN_B5,
    'biotin': CANONICAL_KEYS.VITAMIN_B7,
    'folate': CANONICAL_KEYS.VITAMIN_B9,
    'folic acid': CANONICAL_KEYS.VITAMIN_B9,
    
    'ca': CANONICAL_KEYS.CALCIUM,
    'fe': CANONICAL_KEYS.IRON,
    'mg': CANONICAL_KEYS.MAGNESIUM,
    'k': CANONICAL_KEYS.POTASSIUM,
    'zn': CANONICAL_KEYS.ZINC
};

const categorizeNutrients = (rawNutrients = {}) => {
    const categorized = { mainNutrients: {}, otherNutrients: {} };

    for (const [key, value] = Object.entries(rawNutrients)) {
        if (typeof value !== 'number' || isNaN(value)) continue;

        const cleanKey = key.toLowerCase().trim();
        const officialKey = SYNONYM_MAP[cleanKey] || cleanKey.replace(/\s+(.)/g, match => match[1].toUpperCase());
        
        const targetBucket = MAIN_NUTRIENT_LIST.includes(officialKey) 
            ? categorized.mainNutrients 
            : categorized.otherNutrients;

        if (targetBucket[officialKey]) {
            targetBucket[officialKey] += value;
        } else {
            targetBucket[officialKey] = value;
        }
    }
    return categorized;
};

module.exports = { categorizeNutrients, CANONICAL_KEYS };