/**
 * CS2 Statistics Grading System
 * Provides letter grades (S, A, B, C, D, F) for various CS2 performance metrics
 */

import { formatAsPercentage } from './dataFormatter';

export interface StatGrade {
  grade: 'S' | 'A' | 'B' | 'C' | 'D' | 'F';
  color: number; // Discord embed color
  emoji: string;
  description: string;
}

export interface GradedStat {
  value: number;
  formattedValue: string;
  grade: StatGrade;
}

// Define grade thresholds and properties
const GRADE_DEFINITIONS: Record<string, StatGrade> = {
  S: {
    grade: 'S',
    color: 0xFF6B00, // Bright orange
    emoji: '🔥',
    description: 'Exceptional'
  },
  A: {
    grade: 'A',
    color: 0x00FF00, // Green
    emoji: '⭐',
    description: 'Excellent'
  },
  B: {
    grade: 'B',
    color: 0x90EE90, // Light green
    emoji: '✨',
    description: 'Good'
  },
  C: {
    grade: 'C',
    color: 0xFFFF00, // Yellow
    emoji: '👍',
    description: 'Average'
  },
  D: {
    grade: 'D',
    color: 0xFFA500, // Orange
    emoji: '👎',
    description: 'Below Average'
  },
  F: {
    grade: 'F',
    color: 0xFF0000, // Red
    emoji: '💀',
    description: 'Poor'
  }
};

// Statistical thresholds for different metrics
const STAT_THRESHOLDS = {
  // K/D Ratio thresholds
  killDeathRatio: {
    S: 1.50, // Top 5%
    A: 1.25, // Top 15%
    B: 1.10, // Top 35%
    C: 0.95, // Average
    D: 0.80, // Below average
    F: 0     // Bottom
  },
  
  // Average Damage per Round
  damagePerRound: {
    S: 85,   // Exceptional
    A: 75,   // Excellent
    B: 65,   // Good
    C: 55,   // Average
    D: 45,   // Below average
    F: 0     // Poor
  },
  
  // Headshot Percentage
  headshotPercentage: {
    S: 60,   // 60%+
    A: 50,   // 50%+
    B: 40,   // 40%+
    C: 30,   // 30%+
    D: 20,   // 20%+
    F: 0     // Below 20%
  },
  
  // Win Rate
  winRate: {
    S: 70,   // 70%+
    A: 60,   // 60%+
    B: 55,   // 55%+
    C: 50,   // 50% (balanced)
    D: 45,   // 45%+
    F: 0     // Below 45%
  },
  
  // Rating (Leetify/HLTV style)
  averageRating: {
    S: 1.30, // Elite
    A: 1.15, // Very good
    B: 1.05, // Above average
    C: 0.95, // Average
    D: 0.85, // Below average
    F: 0     // Poor
  },
  
  // First Kill Rate (%)
  firstKillRate: {
    S: 15,   // 15%+ rounds with first kill (exceptional entry fragging)
    A: 12,   // 12%+
    B: 9,    // 9%+
    C: 6,    // 6%+
    D: 3,    // 3%+
    F: 0     // Below 3%
  },
  
  // Clutch Rate (%)
  clutchRate: {
    S: 25,   // 25%+ clutch success (exceptional)
    A: 20,   // 20%+
    B: 15,   // 15%+
    C: 12,   // 12%+
    D: 8,    // 8%+
    F: 0     // Below 8%
  },
  
  // Multi-kill Rate (%)
  multiKillRate: {
    S: 25,   // 25%+ rounds with multi-kill
    A: 20,   // 20%+
    B: 15,   // 15%+
    C: 12,   // 12%+
    D: 8,    // 8%+
    F: 0     // Below 8%
  },
  
  // Utility Damage per Round
  utilityDamage: {
    S: 8,    // 8+ utility damage per round
    A: 6,    // 6+
    B: 4,    // 4+
    C: 3,    // 3+
    D: 2,    // 2+
    F: 0     // Below 2
  },
  
  // Smoke Success Rate (%)
  smokeSuccessRate: {
    S: 80,   // 80%+ effective smokes
    A: 70,   // 70%+
    B: 60,   // 60%+
    C: 50,   // 50%+
    D: 40,   // 40%+
    F: 0     // Below 40%
  }
};

/**
 * Calculate grade for a specific statistic
 */
function calculateGrade(value: number, thresholds: typeof STAT_THRESHOLDS.killDeathRatio): StatGrade {
  if (value >= thresholds.S) return GRADE_DEFINITIONS.S;
  if (value >= thresholds.A) return GRADE_DEFINITIONS.A;
  if (value >= thresholds.B) return GRADE_DEFINITIONS.B;
  if (value >= thresholds.C) return GRADE_DEFINITIONS.C;
  if (value >= thresholds.D) return GRADE_DEFINITIONS.D;
  return GRADE_DEFINITIONS.F;
}

/**
 * Format numeric values for display
 */
function formatValue(value: number, type: string): string {
  switch (type) {
    case 'ratio':
      return value.toFixed(2);
    case 'percentage':
      return `${value.toFixed(1)}%`;
    case 'damage':
      return value.toFixed(1);
    case 'integer':
      return Math.round(value).toString();
    default:
      return value.toFixed(2);
  }
}

/**
 * Grade player's K/D ratio
 */
export function gradeKillDeathRatio(kdRatio: number): GradedStat {
  const grade = calculateGrade(kdRatio, STAT_THRESHOLDS.killDeathRatio);
  return {
    value: kdRatio,
    formattedValue: formatValue(kdRatio, 'ratio'),
    grade
  };
}

/**
 * Grade player's average damage per round
 */
export function gradeDamagePerRound(adr: number): GradedStat {
  const grade = calculateGrade(adr, STAT_THRESHOLDS.damagePerRound);
  return {
    value: adr,
    formattedValue: formatValue(adr, 'damage'),
    grade
  };
}

/**
 * Grade player's headshot percentage
 */
export function gradeHeadshotPercentage(hsPercentage: number): GradedStat {
  const percentage = hsPercentage * 100; // Convert from decimal to percentage for grading thresholds
  const grade = calculateGrade(percentage, STAT_THRESHOLDS.headshotPercentage);
  return {
    value: hsPercentage,
    formattedValue: formatAsPercentage(hsPercentage, 1),
    grade
  };
}

/**
 * Grade player's win rate
 */
export function gradeWinRate(winRate: number): GradedStat {
  const percentage = winRate * 100; // Convert from decimal to percentage for grading thresholds
  const grade = calculateGrade(percentage, STAT_THRESHOLDS.winRate);
  return {
    value: winRate,
    formattedValue: formatAsPercentage(winRate, 1),
    grade
  };
}

/**
 * Grade player's average rating
 */
export function gradeAverageRating(rating: number): GradedStat {
  const grade = calculateGrade(rating, STAT_THRESHOLDS.averageRating);
  return {
    value: rating,
    formattedValue: formatValue(rating, 'ratio'),
    grade
  };
}

/**
 * Grade player's first kill rate
 */
export function gradeFirstKillRate(firstKillRate: number): GradedStat {
  const percentage = firstKillRate * 100; // Convert from decimal to percentage for grading thresholds
  const grade = calculateGrade(percentage, STAT_THRESHOLDS.firstKillRate);
  return {
    value: firstKillRate,
    formattedValue: formatAsPercentage(firstKillRate, 1),
    grade
  };
}

/**
 * Grade player's clutch success rate
 */
export function gradeClutchRate(clutchRate: number): GradedStat {
  const percentage = clutchRate * 100; // Convert from decimal to percentage for grading thresholds
  const grade = calculateGrade(percentage, STAT_THRESHOLDS.clutchRate);
  return {
    value: clutchRate,
    formattedValue: formatAsPercentage(clutchRate, 1),
    grade
  };
}

/**
 * Grade player's multi-kill rate
 */
export function gradeMultiKillRate(multiKillRate: number): GradedStat {
  const percentage = multiKillRate * 100; // Convert from decimal to percentage for grading thresholds
  const grade = calculateGrade(percentage, STAT_THRESHOLDS.multiKillRate);
  return {
    value: multiKillRate,
    formattedValue: formatAsPercentage(multiKillRate, 1),
    grade
  };
}

/**
 * Grade player's utility damage
 */
export function gradeUtilityDamage(utilityDamage: number): GradedStat {
  const grade = calculateGrade(utilityDamage, STAT_THRESHOLDS.utilityDamage);
  return {
    value: utilityDamage,
    formattedValue: formatValue(utilityDamage, 'damage'),
    grade
  };
}

/**
 * Grade player's smoke success rate
 */
export function gradeSmokeSuccessRate(smokeSuccessRate: number): GradedStat {
  const percentage = smokeSuccessRate * 100; // Convert from decimal to percentage for grading thresholds
  const grade = calculateGrade(percentage, STAT_THRESHOLDS.smokeSuccessRate);
  return {
    value: smokeSuccessRate,
    formattedValue: formatAsPercentage(smokeSuccessRate, 1),
    grade
  };
}

/**
 * Calculate an overall performance grade based on key statistics
 */
export function calculateOverallGrade(stats: {
  kdRatio: number;
  adr: number;
  rating: number;
  winRate: number;
  headshotPercentage: number;
  firstKillRate?: number;
  clutchRate?: number;
}): GradedStat {
  // Weight different stats for overall calculation 
  const weights = {
    rating: 0.25,      // Important base metric
    kdRatio: 0.20,     // Core performance
    adr: 0.15,         // Impact per round
    winRate: 0.25,     // Most important - actually winning games
    headshotPercentage: 0.05,  // Skill indicator
    firstKillRate: 0.05, // Entry impact
    clutchRate: 0.05   // Clutch impact
  };
  
  // Calculate normalized scores (0-5 scale)
  const ratingScore = Math.min(Math.max((stats.rating - 0.5) * 2.5, 0), 5); // 0.5-1.5 maps to 0-2.5
  const kdScore = Math.min(Math.max((stats.kdRatio - 0.5) * 2.5, 0), 5); // 0.5-2.5 maps to 0-5
  const adrScore = Math.min(Math.max((stats.adr - 30) / 15, 0), 5); // 30-105 maps to 0-5
  const winScore = Math.min(Math.max((stats.winRate - 20) / 12, 0), 5); // 20-80% maps to 0-5
  const hsScore = Math.min(Math.max((stats.headshotPercentage - 15) / 12, 0), 5); // 15-75% maps to 0-5
  const firstKillScore = stats.firstKillRate ? Math.min(Math.max((stats.firstKillRate - 2) / 6, 0), 5) : 2.5; // 2-20% maps to 0-5
  const clutchScore = stats.clutchRate ? Math.min(Math.max((stats.clutchRate - 5) / 8, 0), 5) : 2.5; // 5-25% maps to 0-5
  
  const weightedScore = (
    ratingScore * weights.rating +
    kdScore * weights.kdRatio +
    adrScore * weights.adr +
    winScore * weights.winRate +
    hsScore * weights.headshotPercentage +
    firstKillScore * weights.firstKillRate +
    clutchScore * weights.clutchRate
  );
  
  // Convert to grade - more realistic thresholds
  let grade: StatGrade;
  if (weightedScore >= 4.0) grade = GRADE_DEFINITIONS.S; // Exceptional across the board
  else if (weightedScore >= 3.2) grade = GRADE_DEFINITIONS.A; // Strong overall
  else if (weightedScore >= 2.4) grade = GRADE_DEFINITIONS.B; // Above average
  else if (weightedScore >= 1.8) grade = GRADE_DEFINITIONS.C; // Average
  else if (weightedScore >= 1.0) grade = GRADE_DEFINITIONS.D; // Below average
  else grade = GRADE_DEFINITIONS.F; // Poor
  
  return {
    value: weightedScore,
    formattedValue: `${(weightedScore / 5 * 100).toFixed(0)}%`,
    grade
  };
}

/**
 * Get color for embed based on overall performance
 */
export function getOverallEmbedColor(overallGrade: StatGrade): number {
  return overallGrade.color;
}

/**
 * Format a graded stat for display in Discord embed
 */
export function formatGradedStat(stat: GradedStat, label: string): string {
  return `${stat.grade.emoji} **${stat.formattedValue}** (${stat.grade.grade})`;
}

/**
 * Create a progress bar visualization for stats
 */
export function createStatProgressBar(value: number, max: number, length: number = 10): string {
  const percentage = Math.min(value / max, 1);
  const filled = Math.round(percentage * length);
  const empty = length - filled;
  
  return '█'.repeat(filled) + '░'.repeat(empty);
}