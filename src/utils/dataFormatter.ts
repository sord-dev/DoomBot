/**
 * Data formatting utilities to handle inconsistent Leetify API formats
 * 
 * The Leetify API is inconsistent with percentage formats:
 * - Profile API: Most percentages as whole numbers (34.39 = 34.39%)
 * - Match API: Most percentages as decimals (0.3439 = 34.39%)  
 * - Some fields like winrate are always decimals across both APIs
 * 
 * This module provides standardized conversion with API endpoint awareness.
 */

// Define which fields from which API endpoints use which format
const API_FIELD_FORMATS = {
  // Profile API (/v3/profile) - mostly whole numbers
  profile: {
    decimal_fields: [
      'winrate',  // Always 0.6429 format
      'preaim',   // Usually decimal
      'utility_on_death_avg', // Raw values, not percentages
      'he_foes_damage_avg',   // Raw values
      'he_friends_damage_avg', // Raw values  
      'reaction_time_ms',      // Raw values
      'flashbang_hit_foe_avg_duration', // Raw values
      'flashbang_thrown',      // Raw values
      'trade_kill_opportunities_per_round', // Raw values
      'flashbang_hit_foe_per_flashbang',   // Raw count: enemies per flash
      'flashbang_hit_friend_per_flashbang', // Raw count: teammates per flash
      'clutch',    // Relative rating value like +9.61
      'opening'    // Relative rating value like +4.38
    ],
    percentage_fields: [
      'accuracy_enemy_spotted',
      'accuracy_head', 
      'counter_strafing_good_shots_ratio',
      'ct_opening_aggression_success_rate',
      'ct_opening_duel_success_percentage',
      't_opening_aggression_success_rate', 
      't_opening_duel_success_percentage',
      'flashbang_leading_to_kill',
      'traded_deaths_success_percentage',
      'trade_kills_success_percentage',
      'spray_accuracy'
    ]
  },
  // Match API (/v3/profile/matches) - mostly decimals
  match: {
    decimal_fields: [
      'accuracy_enemy_spotted',
      'accuracy_head',
      'counter_strafing_shots_good_ratio', 
      'trade_kill_attempts_percentage',
      'trade_kills_success_percentage', 
      'traded_death_attempts_percentage',
      'traded_deaths_success_percentage',
      'rounds_survived_percentage',
      'spray_accuracy'
    ],
    percentage_fields: [
      // Most match-level percentages come as decimals, but some might be whole numbers
      'ct_opening_duel_success_percentage', // This one is inconsistent
      't_opening_duel_success_percentage'
    ]
  }
};

export type ApiEndpoint = 'profile' | 'match';

/**
 * Normalize a value to decimal format (0.0-1.0) for internal use
 * Uses API endpoint awareness to handle inconsistent formats correctly
 */
export function normalizeToDecimal(
  value: number, 
  fieldName: string, 
  sourceApi: ApiEndpoint = 'profile'
): number {
  // Handle edge cases
  if (value === null || value === undefined || isNaN(value)) {
    return 0;
  }

  // Check if this field is known to be in decimal format from this API
  const apiConfig = API_FIELD_FORMATS[sourceApi];
  if (apiConfig.decimal_fields.includes(fieldName)) {
    return value; // Already in decimal format
  }

  // Check if this field is known to be in percentage format from this API  
  if (apiConfig.percentage_fields.includes(fieldName)) {
    return sourceApi === 'profile' ? value / 100 : value; // Profile = %, Match = decimal
  }

  // Fallback: Smart detection for unknown fields
  // If value > 1, assume it's a percentage (convert to decimal)
  // If value <= 1, assume it's already a decimal
  return value > 1 ? value / 100 : value;
}

/**
 * Convert a decimal value (0.0-1.0) to display percentage format
 */
export function formatAsPercentage(decimalValue: number, decimals: number = 1): string {
  return `${(decimalValue * 100).toFixed(decimals)}%`;
}

/**
 * Convert a raw API value to display percentage format with API awareness
 */
export function formatApiValueAsPercentage(
  value: number, 
  fieldName: string, 
  sourceApi: ApiEndpoint = 'profile',
  decimals: number = 1
): string {
  const normalizedValue = normalizeToDecimal(value, fieldName, sourceApi);
  return formatAsPercentage(normalizedValue, decimals);
}

/**
 * Tiered benchmarks based on Premier rating brackets
 * Each tier represents the average performance for that Premier rating range
 */
export const PREMIER_BENCHMARKS = {
  // 15,000-19,999 Premier Rating
  15000: {
    ratings: {
      aim: 66,          
      positioning: 53,   
      utility: 58,      
      clutch: 10.49,    
      opening: 0.01,    
    },
    stats: {
      accuracy_enemy_spotted: 0.18,
      counter_strafing_good_shots_ratio: 0.55,  
      ct_opening_duel_success_percentage: 0.37,
      t_opening_duel_success_percentage: 0.37,
      ct_opening_aggression_success_rate: 0.35,
      t_opening_aggression_success_rate: 0.40,
      flashbang_hit_foe_per_flashbang: 0.6,
      flashbang_hit_friend_per_flashbang: 0.4,
      flashbang_leading_to_kill: 0.2,
      flashbang_hit_foe_avg_duration: 1.5,
      flashbang_thrown: 5.0,
      he_foes_damage_avg: 20.0,
      he_friends_damage_avg: 2.0,
      preaim: 0.85,
      reaction_time_ms: 350.0,
      spray_accuracy: 0.65,
      traded_deaths_success_percentage: 0.78,
      trade_kill_opportunities_per_round: 1.2,
      trade_kills_success_percentage: 0.75,
      utility_on_death_avg: 0.3,
      accuracy_head: 0.40,
    }
  },
  // 10,000-14,999 Premier Rating  
  10000: {
    ratings: {
      aim: 58,          
      positioning: 51,   
      utility: 55,      
      clutch: 10.68,    
      opening: -0.07,   
    },
    stats: {
      accuracy_enemy_spotted: 0.17,
      counter_strafing_good_shots_ratio: 0.52,  
      ct_opening_duel_success_percentage: 0.35,
      t_opening_duel_success_percentage: 0.35,
      ct_opening_aggression_success_rate: 0.33,
      t_opening_aggression_success_rate: 0.38,
      flashbang_hit_foe_per_flashbang: 0.55,
      flashbang_hit_friend_per_flashbang: 0.45,
      flashbang_leading_to_kill: 0.18,
      flashbang_hit_foe_avg_duration: 1.4,
      flashbang_thrown: 4.5,
      he_foes_damage_avg: 18.0,
      he_friends_damage_avg: 2.5,
      preaim: 0.8,
      reaction_time_ms: 365.0,
      spray_accuracy: 0.6,
      traded_deaths_success_percentage: 0.75,
      trade_kill_opportunities_per_round: 1.1,
      trade_kills_success_percentage: 0.72,
      utility_on_death_avg: 0.35,
      accuracy_head: 0.38,
    }
  },
  // 5,000-9,999 Premier Rating
  5000: {
    ratings: {
      aim: 48,          
      positioning: 50,   
      utility: 51,      
      clutch: 10.81,    
      opening: -0.24,   
    },
    stats: {
      accuracy_enemy_spotted: 0.16,
      counter_strafing_good_shots_ratio: 0.48,  
      ct_opening_duel_success_percentage: 0.32,
      t_opening_duel_success_percentage: 0.32,
      ct_opening_aggression_success_rate: 0.30,
      t_opening_aggression_success_rate: 0.35,
      flashbang_hit_foe_per_flashbang: 0.5,
      flashbang_hit_friend_per_flashbang: 0.5,
      flashbang_leading_to_kill: 0.16,
      flashbang_hit_foe_avg_duration: 1.3,
      flashbang_thrown: 4.0,
      he_foes_damage_avg: 16.0,
      he_friends_damage_avg: 3.0,
      preaim: 0.75,
      reaction_time_ms: 380.0,
      spray_accuracy: 0.55,
      traded_deaths_success_percentage: 0.72,
      trade_kill_opportunities_per_round: 1.0,
      trade_kills_success_percentage: 0.68,
      utility_on_death_avg: 0.4,
      accuracy_head: 0.35,
    }
  }
};

/**
 * Get the appropriate benchmark tier based on Premier rating
 */
export function getBenchmarkTier(premierRating?: number): typeof PREMIER_BENCHMARKS[15000] {
  if (!premierRating) {
    return PREMIER_BENCHMARKS[10000]; // Default to 10k-15k bracket
  }
  
  if (premierRating >= 15000) {
    return PREMIER_BENCHMARKS[15000];
  } else if (premierRating >= 10000) {
    return PREMIER_BENCHMARKS[10000];
  } else if (premierRating >= 5000) {
    return PREMIER_BENCHMARKS[5000];
  } else {
    return PREMIER_BENCHMARKS[5000]; // Below 5k uses the 5k-10k benchmarks
  }
}

/**
 * Legacy benchmark object for backward compatibility
 * Now dynamically uses 10k-15k bracket as default
 */
export const BENCHMARK_DECIMALS = PREMIER_BENCHMARKS[10000];


/**
 * Format a Leetify relative rating for display
 * These are skill-bracket-relative values like +9.61, -2.14, not percentages
 */
export function formatLeetifyRating(rating: number): string {
  const sign = rating >= 0 ? '+' : '';
  return `${sign}${rating.toFixed(2)}`;
}

/**
 * Determine performance level for Leetify relative ratings
 * Based on typical Leetify relative value ranges
 */
export function getLeetifyRatingLevel(rating: number): {
  level: 'Excellent' | 'Good' | 'Average' | 'Below Average' | 'Poor';
  color: string;
  emoji: string;
} {
  if (rating >= 8.0) return { level: 'Excellent', color: '🟢', emoji: '🔥' };
  if (rating >= 3.0) return { level: 'Good', color: '🟢', emoji: '✨' };
  if (rating >= -2.0) return { level: 'Average', color: '🟡', emoji: '👍' };
  if (rating >= -6.0) return { level: 'Below Average', color: '🟠', emoji: '👎' };
  return { level: 'Poor', color: '🔴', emoji: '💀' };
}

/**
 * Get performance level and improvement suggestion based on benchmark comparison
 */
export function getBenchmarkComparison(
  apiValue: number,
  fieldName: string,
  sourceApi: ApiEndpoint = 'profile'
): {
  meetsbenchmark: boolean;
  performance: 'Excellent' | 'Good' | 'Average' | 'Below Average' | 'Poor';
  improvementNeeded: 'None' | 'Minor' | 'Moderate' | 'Major';
  percentageAboveBenchmark: number;
} {
  const benchmark = BENCHMARK_DECIMALS.stats[fieldName as keyof typeof BENCHMARK_DECIMALS.stats];
  if (benchmark === undefined) {
    return {
      meetsbenchmark: true,
      performance: 'Average',
      improvementNeeded: 'None',
      percentageAboveBenchmark: 0
    };
  }

  const normalizedValue = normalizeToDecimal(apiValue, fieldName, sourceApi);
  
  // Handle inverted metrics (lower is better)
  const isInvertedMetric = fieldName === 'reaction_time_ms' || 
                          fieldName === 'he_friends_damage_avg' ||
                          fieldName === 'utility_on_death_avg';
  
  let meetsbenchmark: boolean;
  let percentageAboveBenchmark: number;
  
  if (isInvertedMetric) {
    meetsbenchmark = normalizedValue <= benchmark;
    percentageAboveBenchmark = ((benchmark - normalizedValue) / benchmark) * 100;
  } else {
    meetsbenchmark = normalizedValue >= benchmark;
    percentageAboveBenchmark = ((normalizedValue - benchmark) / benchmark) * 100;
  }

  // Determine performance level based on how far above/below benchmark
  let performance: 'Excellent' | 'Good' | 'Average' | 'Below Average' | 'Poor';
  let improvementNeeded: 'None' | 'Minor' | 'Moderate' | 'Major';

  if (percentageAboveBenchmark >= 30) {
    performance = 'Excellent';
    improvementNeeded = 'None';
  } else if (percentageAboveBenchmark >= 10) {
    performance = 'Good';
    improvementNeeded = 'None';
  } else if (percentageAboveBenchmark >= -5) {
    performance = 'Average';
    improvementNeeded = 'Minor';
  } else if (percentageAboveBenchmark >= -20) {
    performance = 'Below Average';
    improvementNeeded = 'Moderate';
  } else {
    performance = 'Poor';
    improvementNeeded = 'Major';
  }

  return {
    meetsbenchmark,
    performance,
    improvementNeeded,
    percentageAboveBenchmark: Math.round(percentageAboveBenchmark * 10) / 10
  };
}

/**
 * Generate trend emoji based on benchmark performance
 */
export function getTrendEmoji(
  currentValue: number,
  fieldName: string,
  sourceApi: ApiEndpoint = 'profile'
): string {
  const comparison = getBenchmarkComparison(currentValue, fieldName, sourceApi);
  
  if (comparison.performance === 'Excellent') return '🔥';
  if (comparison.performance === 'Good') return '✨';
  if (comparison.performance === 'Average') return '👍';
  if (comparison.performance === 'Below Average') return '👎';
  return '💀';
}

export function compareAgainstBenchmark(
  apiValue: number,
  fieldName: string, 
  sourceApi: ApiEndpoint = 'profile',
  benchmarkTier?: typeof PREMIER_BENCHMARKS[15000]
): boolean {
  const benchmarks = benchmarkTier || BENCHMARK_DECIMALS;
  const benchmark = benchmarks.stats[fieldName as keyof typeof benchmarks.stats];
  if (benchmark === undefined) {
    return true; // No benchmark defined, assume OK
  }

  // Handle raw value fields (not percentages)
  const nonPercentageFields = [
    'he_foes_damage_avg', 
    'utility_on_death_avg',
    'reaction_time_ms',
    'flashbang_hit_foe_avg_duration', 
    'flashbang_thrown',
    'he_friends_damage_avg',
    'trade_kill_opportunities_per_round',
    'preaim'
  ];

  // Fields where LOWER values are BETTER
  const lowerIsBetterFields = [
    'reaction_time_ms',
    'utility_on_death_avg', 
    'he_friends_damage_avg',
    'flashbang_hit_friend_per_flashbang' // Lower teamflashing is better
  ];

  if (nonPercentageFields.includes(fieldName)) {
    // For raw values, direct comparison
    if (lowerIsBetterFields.includes(fieldName)) {
      return apiValue <= benchmark; // Lower is better for these metrics
    }
    return apiValue >= benchmark; // Higher is better for most raw values
  }

  // For percentage fields, normalize both to decimal format
  const normalizedValue = normalizeToDecimal(apiValue, fieldName, sourceApi);
  
  // Check if this percentage field is "lower is better"
  if (lowerIsBetterFields.includes(fieldName)) {
    return normalizedValue <= benchmark; // Lower is better
  }
  
  return normalizedValue >= benchmark; // Higher is better for most percentage fields
}