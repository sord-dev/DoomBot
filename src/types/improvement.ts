/**
 * Type definitions for CS2 improvement analysis
 */

export interface RawLeetifyProfile {
  name: string;
  ranks?: {
    leetify?: number;
    premier?: number;    // CS2 Premier Rating
    faceit?: number;
    wingman?: number;
    renown?: number;
  };
  rating: {
    aim: number;
    positioning: number;
    utility: number;
    clutch: number;
    opening: number;
    ct_leetify: number;
    t_leetify: number;
  };
  stats: {
    accuracy_enemy_spotted: number;
    accuracy_head: number;
    counter_strafing_good_shots_ratio: number;
    ct_opening_duel_success_percentage: number;
    t_opening_duel_success_percentage: number;
    ct_opening_aggression_success_rate: number;
    t_opening_aggression_success_rate: number;
    flashbang_hit_foe_avg_duration: number;
    flashbang_hit_foe_per_flashbang: number;
    flashbang_hit_friend_per_flashbang: number;
    flashbang_leading_to_kill: number;
    flashbang_thrown: number;
    he_foes_damage_avg: number;
    he_friends_damage_avg: number;
    preaim: number;
    reaction_time_ms: number;
    spray_accuracy: number;
    traded_deaths_success_percentage: number;
    trade_kill_opportunities_per_round: number;
    trade_kills_success_percentage: number;
    utility_on_death_avg: number;
  };
}

export interface Resource {
  type: string;
  link: string;
  description?: string;
}

export interface ImprovementArea {
  category: string;
  rating: number;       // Mixed: 0-100 for aim/utility/positioning, relative values for clutch/opening
  emoji: string;
  issues: string[];     // specific sub-metric issues detected
  drills: string[];     // actionable practice suggestions
  resourceTags: string[]; // tags for resource lookup
}

export interface SideSpecificInsights {
  ctInsights: string[];
  tInsights: string[];
  ctDrills: string[];
  tDrills: string[];
  ctResourceTags: string[];
  tResourceTags: string[];
}

export interface SideBalance {
  hasSideImbalance: boolean;
  weakSide: 'CT' | 'T' | null;
  advice: string;
}

export interface CrossInsight {
  label: string;
  detail: string;
}

export interface SelectedResource {
  title: string;
  link: string;
  emoji: string;
  description: string;
}

export interface ImprovementReport {
  areas: ImprovementArea[];
  focusAreas: ImprovementArea[];  // worst 2-3 only
  playerName: string;
  sideBalance: SideBalance;
  crossInsights: CrossInsight[];
  sideInsights: SideSpecificInsights;
}