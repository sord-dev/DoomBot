/**
 * CS2 performance analysis engine
 * Contains all the core analysis functions for generating improvement reports
 */

import resourceData from '../assets/resources.json';
import { 
  formatApiValueAsPercentage, 
  compareAgainstBenchmark,
  BENCHMARK_DECIMALS,
  getBenchmarkTier,
  formatLeetifyRating,
  getLeetifyRatingLevel,
} from './dataFormatter';
import type {
  RawLeetifyProfile,
  ImprovementArea,
  SideSpecificInsights,
  SideBalance,
  CrossInsight,
  SelectedResource,
  ImprovementReport,
  Resource
} from '../types/improvement';

const resources = resourceData as Record<string, Resource[]>;

// ─── advice engine ───────────────────────────────────────────────────────────

export function analyseAim(stats: RawLeetifyProfile['stats'], rating: number, benchmarkTier: any): ImprovementArea {
  const issues: string[] = [];
  const drills: string[] = [];
  const resourceTags: string[] = [];

  if (!compareAgainstBenchmark(stats.accuracy_enemy_spotted, 'accuracy_enemy_spotted', 'profile', benchmarkTier)) {
    issues.push(`Low accuracy when enemy spotted (${formatApiValueAsPercentage(stats.accuracy_enemy_spotted, 'accuracy_enemy_spotted', 'profile')} — aim for 18%+)`);
    drills.push('aim_botz — 100 kills at close/medium range daily, focus on crosshair placement not speed');
    resourceTags.push('aim_accuracy');
  }

  // headshot accuracy — compound check with overall accuracy
  if (compareAgainstBenchmark(stats.accuracy_enemy_spotted, 'accuracy_enemy_spotted', 'profile', benchmarkTier)
      && !compareAgainstBenchmark(stats.accuracy_head, 'accuracy_head', 'profile', benchmarkTier)) {
    issues.push(`You hit your shots but aim body too often (${formatApiValueAsPercentage(stats.accuracy_head, 'accuracy_head', 'profile')} headshots)`);
    drills.push('Your accuracy is fine — the problem is crosshair placement. Focus on keeping crosshair at head height at all times');
    resourceTags.push('crosshair_placement');
  } else if (!compareAgainstBenchmark(stats.accuracy_head, 'accuracy_head', 'profile', benchmarkTier)) {
    issues.push(`Low headshot accuracy (${formatApiValueAsPercentage(stats.accuracy_head, 'accuracy_head', 'profile')} — aim for 40%+)`);
    drills.push('Play deathmatch with AK only, force yourself to tap/burst at head level — never spray at body');
    resourceTags.push('crosshair_placement');
  }

  if (!compareAgainstBenchmark(stats.counter_strafing_good_shots_ratio, 'counter_strafing_good_shots_ratio', 'profile', benchmarkTier)) {
    issues.push(`You're firing while still moving too often (${formatApiValueAsPercentage(stats.counter_strafing_good_shots_ratio, 'counter_strafing_good_shots_ratio', 'profile')} clean shots)`);
    drills.push('counter_strafing workshop map — only shoot when fully stopped, build the habit before worrying about speed');
    resourceTags.push('counter_strafing');
  }

  if (!compareAgainstBenchmark(stats.spray_accuracy, 'spray_accuracy', 'profile', benchmarkTier)) {
    issues.push(`Spray control is weak (${formatApiValueAsPercentage(stats.spray_accuracy, 'spray_accuracy', 'profile')} accuracy in sprays)`);
    drills.push('recoil master workshop — learn AK and M4 spray patterns, 15 mins a day for 2 weeks will fix this');
    resourceTags.push('spray_control');
  }

  if (!compareAgainstBenchmark(stats.preaim, 'preaim', 'profile', benchmarkTier)) {
    issues.push(`Not pre-aiming common angles (preaim score: ${stats.preaim.toFixed(2)})`);
    drills.push('deathmatch on your most played map — move crosshair to head height on every corner BEFORE you see anyone');
    resourceTags.push('crosshair_placement');
  }

  if (!compareAgainstBenchmark(stats.reaction_time_ms, 'reaction_time_ms', 'profile', benchmarkTier)) {
    issues.push(`Reaction time is slow (${stats.reaction_time_ms.toFixed(0)}ms avg — aim for sub-350ms)`);
    drills.push('aim_botz reflex training — 200 kills, reaction mode. Also check your monitor refresh rate and in-game sensitivity');
    resourceTags.push('reaction_time');
  }

  if (issues.length === 0) {
    const difference = rating - benchmarkTier.ratings.aim;
    const performance = difference >= 15 ? 'excellent' : difference >= 5 ? 'good' : 'solid';
    issues.push(`Aim fundamentals are ${performance} (${rating}/100)`);
  }

  return {
    category: 'Aim',
    rating,
    emoji: '🎯',
    issues,
    drills,
    resourceTags
  };
}

// ─── enhanced ct/t analysis ─────────────────────────────────────────────────

export function analyzeCTTSideWeaknesses(
  stats: RawLeetifyProfile['stats'],
  ctRatingRaw: number,
  tRatingRaw: number
): SideSpecificInsights {
  const ctInsights: string[] = [];
  const tInsights: string[] = [];
  const ctDrills: string[] = [];
  const tDrills: string[] = [];
  const ctResourceTags: string[] = [];
  const tResourceTags: string[] = [];

  // CT Side Deep Analysis
  const ctOpeningPct = parseFloat(formatApiValueAsPercentage(stats.ct_opening_duel_success_percentage, 'ct_opening_duel_success_percentage', 'profile', 1).replace('%', ''));
  const ctAggressionPct = parseFloat(formatApiValueAsPercentage(stats.ct_opening_aggression_success_rate, 'ct_opening_aggression_success_rate', 'profile', 1).replace('%', ''));
  
  if (ctOpeningPct < 45) { // More lenient threshold for detailed analysis
    if (ctOpeningPct < 25) {
      ctInsights.push(`CT opening duels are failing badly (${ctOpeningPct.toFixed(1)}%) - you're losing most first contacts`);
      ctInsights.push(`→ This suggests poor CT positioning and angle selection`);
      ctDrills.push('Stop wide peeking common angles - CTs should use tight angles and cover');
      ctDrills.push('Practice pre-aiming head level on every common peek (Long, Short, Ramp, etc.)');
    } else {
      ctInsights.push(`CT opening duels below average (${ctOpeningPct.toFixed(1)}%) - work on angle selection`);
      ctDrills.push('Learn 2-3 off-angles per site that give you advantages over T entries');
      ctDrills.push('Hold closer angles and use jiggle peeking to get information safely');
    }
    ctResourceTags.push('ct_angles', 'ct_positioning');
  }
  
  if (ctAggressionPct < 40) {
    if (ctAggressionPct < 20) {
      ctInsights.push(`CT aggression is failing severely (${ctAggressionPct.toFixed(1)}%) - avoid pushing entirely`);
      ctInsights.push(`→ When you do push as CT, you're getting punished heavily`);
      ctDrills.push('Play purely passive - hold sites and rotate for retakes only');
      ctDrills.push('Focus on staying alive for rotates rather than seeking opening frags');
    } else {
      ctInsights.push(`CT pushes aren't working (${ctAggressionPct.toFixed(1)}%) - be more selective`);
      ctDrills.push('Only push when you have info (teammate spotted enemies elsewhere)');
      ctDrills.push('Use utility before pushing - smoke/flash yourself in, don\'t dry peek');
    }
    ctResourceTags.push('ct_utility', 'ct_positioning');
  }
  
  // Analyze CT utility issues specifically
  if (!compareAgainstBenchmark(stats.flashbang_hit_friend_per_flashbang, 'flashbang_hit_friend_per_flashbang', 'profile')) {
    ctInsights.push(`Teamflashing too much (${stats.flashbang_hit_friend_per_flashbang.toFixed(2)} teammates/flash)`);
    ctInsights.push(`→ Your flashes are hitting teammates more than helping team`);
    ctDrills.push('Learn CT pop-flashes that curve around corners - never throw over teammates');
    ctResourceTags.push('pop_flashes', 'ct_utility');
  }
  
  if (stats.he_foes_damage_avg < 15 && stats.he_friends_damage_avg > 3) {
    ctInsights.push(`HE grenades hitting teammates more than enemies - poor nade timing`);
    ctInsights.push(`→ HE damage: ${stats.he_foes_damage_avg.toFixed(1)} to enemies, ${stats.he_friends_damage_avg.toFixed(1)} to teammates`);
    ctDrills.push('Only throw HEs at confirmed enemy positions, never spam common spots');
    ctResourceTags.push('he_grenades', 'ct_utility');
  }

  // T Side Deep Analysis  
  const tOpeningPct = parseFloat(formatApiValueAsPercentage(stats.t_opening_duel_success_percentage, 't_opening_duel_success_percentage', 'profile', 1).replace('%', ''));
  const tAggressionPct = parseFloat(formatApiValueAsPercentage(stats.t_opening_aggression_success_rate, 't_opening_aggression_success_rate', 'profile', 1).replace('%', ''));
  
  if (tOpeningPct < 45) {
    if (tOpeningPct < 25) {
      tInsights.push(`T opening duels are failing badly (${tOpeningPct.toFixed(1)}%) - you're losing most entry attempts`);
      tInsights.push(`→ This indicates poor T-side positioning and utility usage`);
      tDrills.push('Never peek without utility - use pop-flashes or smoke executes before every entry');
      tDrills.push('Practice shoulder peeking to get info before committing to full peeks');
    } else {
      tInsights.push(`T opening duels below average (${tOpeningPct.toFixed(1)}%) - entries need better setup`);
      tDrills.push('Coordinate with teammates - one person flashes, another peeks immediately');
      tDrills.push('Learn basic T-side executes: A site smoke+flash, B site pop-flash entries');
    }
    tResourceTags.push('t_entry', 't_positioning', 'pop_flashes');
  }
  
  if (tAggressionPct < 45) {
    if (tAggressionPct < 25) {
      tInsights.push(`T entries are failing severely (${tAggressionPct.toFixed(1)}%) - you're being shut down completely`);
      tInsights.push(`→ Your T-side aggression attempts are almost always unsuccessful`);
      tDrills.push('Focus on utility-heavy executes - never dry peek angles CTs are watching');
      tDrills.push('Practice 5-man executes with team utility rather than solo entries');
    } else {
      tInsights.push(`T aggression success is low (${tAggressionPct.toFixed(1)}%) - entries need better timing`);
      tDrills.push('Time your peeks with utility - peek right as your flash pops, not before');
      tDrills.push('Learn to trade your teammates - follow up immediately when someone dies');
    }
    tResourceTags.push('t_entry', 'flash_timing', 't_utility');
  }
  
  // T-side utility analysis
  if (!compareAgainstBenchmark(stats.flashbang_hit_foe_per_flashbang, 'flashbang_hit_foe_per_flashbang', 'profile')) {
    tInsights.push(`T-side flashes not hitting enemies (${stats.flashbang_hit_foe_per_flashbang.toFixed(2)} enemies/flash)`);
    tInsights.push(`→ Your T-side flashes are mostly whiffing and not blinding CTs`);
    tDrills.push('Learn specific T-side pop-flash lineups for each site entry');
    tResourceTags.push('pop_flashes', 't_utility');
  }
  
  if (!compareAgainstBenchmark(stats.trade_kills_success_percentage, 'trade_kills_success_percentage', 'profile')) {
    tInsights.push(`Not trading teammates effectively (${formatApiValueAsPercentage(stats.trade_kills_success_percentage, 'trade_kills_success_percentage', 'profile')} trade rate)`);
    tInsights.push(`→ When teammates die, you're failing to get the revenge frag`);
    tDrills.push('Stay closer to your entry fraggers - be ready to peek immediately when they die');
    tResourceTags.push('trade_positioning', 't_positioning');
  }

  // General side analysis using raw relative ratings (more meaningful than converted percentages)
  if (ctInsights.length === 0 && ctRatingRaw < -2.0) {
    // Check if individual stats are actually reasonable despite low rating
    if (ctOpeningPct >= 37 && ctAggressionPct >= 35) {
      const ctTrafficLight = ctRatingRaw >= -2.0 ? '🟢 Average' : ctRatingRaw >= -6.0 ? '🟡 Below average' : '🔴 Significant improvement needed';
      ctInsights.push(`CT side performance: ${ctTrafficLight} (${formatLeetifyRating(ctRatingRaw)}) despite reasonable individual stats`);
      ctInsights.push(`→ Stats show: CT opening duels ${ctOpeningPct.toFixed(1)}%, aggression ${ctAggressionPct.toFixed(1)}%`);
      ctInsights.push(`→ Lower rating likely due to: poor round impact, excessive rotations, or dying early in rounds`);
      ctDrills.push('Focus on staying alive longer on CT - your job is to delay and gather info, not frag');
      ctDrills.push('Play more defensively - hold tight angles and rotate only when certain');
    } else if (ctRatingRaw < -6.0) {
      ctInsights.push(`CT side performance: 🔴 Significant improvement needed (${formatLeetifyRating(ctRatingRaw)}) - major structural issues`);
      ctInsights.push(`→ Stats: CT opening duels ${ctOpeningPct.toFixed(1)}%, aggression success ${ctAggressionPct.toFixed(1)}%`);
      ctInsights.push(`→ This indicates: severe angle problems, over-aggressive play, or poor utility usage`);
      ctDrills.push('Master basic CT fundamentals: hold standard angles, avoid risky peeks, stay alive');
      ctDrills.push('Stop all aggression on CT until basics are fixed - play purely reactive and passive');
    } else {
      ctInsights.push(`CT side performance: 🟡 Below average (${formatLeetifyRating(ctRatingRaw)}) - fundamental CT positioning needs work`);
      ctInsights.push(`→ Stats: CT opening duels ${ctOpeningPct.toFixed(1)}%, aggression ${ctAggressionPct.toFixed(1)}%`);
      ctDrills.push('Focus on basic CT holds: play standard angles until you understand site timings');
      ctDrills.push('Watch pro demos of your favorite map - see how CTs position on each site');
    }
    ctResourceTags.push('ct_positioning', 'ct_angles', 'ct_fundamentals');
  }
  
  // Enhanced CT-side granular analysis
  if (ctOpeningPct >= 45 && ctAggressionPct < 30) {
    ctInsights.push(`Strong CT defense (${ctOpeningPct.toFixed(1)}% duel success) but avoid unnecessary risks`);
    ctInsights.push(`→ Your aggression success is low (${ctAggressionPct.toFixed(1)}%) - stick to what's working`);
    ctDrills.push('Perfect your defensive holds: learn 3 different angles per site to avoid predictability');
    ctDrills.push('Only push when you have clear intel - sound cue, teammate callout, or utility usage');
    ctResourceTags.push('ct_angles', 'shoulder_peeking');
  }
  
  if (ctOpeningPct < 35) {
    ctInsights.push(`CT positioning fundamentals need major work - losing most defensive duels (${ctOpeningPct.toFixed(1)}%)`);
    ctInsights.push(`→ Common CT mistakes: wide peeking, poor crosshair placement, or fighting at wrong ranges`);
    ctDrills.push('Master close angles: play tight corners where rifles beat rifles, not long-range duels');
    ctDrills.push('Pre-aim head height at common peek spots - CT side is about preparation, not reaction');
    ctResourceTags.push('ct_positioning', 'crosshair_placement', 'ct_angles');
  }
  
  if (tInsights.length === 0 && tRatingRaw < -2.0) {
    // Check if individual stats are actually good despite low overall rating
    if (tOpeningPct >= 37 && tAggressionPct >= 40) {
      const tTrafficLight = tRatingRaw >= -2.0 ? '🟢 Average' : tRatingRaw >= -6.0 ? '🟡 Below average' : '🔴 Significant improvement needed';
      tInsights.push(`T side performance: ${tTrafficLight} (${formatLeetifyRating(tRatingRaw)}) despite reasonable individual stats`);
      tInsights.push(`→ Stats show: opening duels ${tOpeningPct.toFixed(1)}%, aggression ${tAggressionPct.toFixed(1)}%`);
      tInsights.push(`→ Lower rating likely due to: poor round conversion, isolated play, or ineffective utility usage`);
      tDrills.push('Focus on team coordination - your entries need to lead to round wins, not just frags');
      tDrills.push('Work on post-entry follow-up: after getting an opening kill, help team convert the advantage');
    } else if (tRatingRaw < -6.0) {
      tInsights.push(`T side performance: 🔴 Significant improvement needed (${formatLeetifyRating(tRatingRaw)}) - major fundamental issues`);
      tInsights.push(`→ Stats: T opening duels ${tOpeningPct.toFixed(1)}%, aggression success ${tAggressionPct.toFixed(1)}%`);
      tInsights.push(`→ This indicates: poor entry timing, inadequate utility use, or playing too isolated from team`);
      tDrills.push('Never peek without utility support - buy flashes/smokes every round and use them first');
      tDrills.push('Stick with your team - coordinate site executes instead of going for solo plays');
    } else {
      tInsights.push(`T side performance: 🟡 Below average (${formatLeetifyRating(tRatingRaw)}) - entry fundamentals need work`);
      tInsights.push(`→ Stats: T opening duels ${tOpeningPct.toFixed(1)}%, aggression success ${tAggressionPct.toFixed(1)}%`);
      tDrills.push('Learn basic T-side utility: buy flashes every round and use them before peeking');
      tDrills.push('Practice coordinated site takes - never go in alone without team support');
    }
    tResourceTags.push('t_positioning', 't_utility', 'demo_review', 't_fundamentals');
  }
  
  // Enhanced T-side granular analysis
  if (tOpeningPct >= 45 && tAggressionPct >= 45) {
    tInsights.push(`Strong T-side entry skills (${tOpeningPct.toFixed(1)}% opening duels, ${tAggressionPct.toFixed(1)}% aggression)`);
    tInsights.push(`→ Your mechanics are solid - focus on converting these advantages into round wins`);
    tDrills.push('Work on post-entry positioning: after getting opening kill, help team trade and execute');
    tDrills.push('Learn to IGL your team after successful entries - call rotates and site executes');
    tResourceTags.push('communication', 'entry_fragger', 'demo_review');
  }
  
  if (tOpeningPct < 35) {
    tInsights.push(`T-side entry fundamentals need major improvement - struggling in opening duels (${tOpeningPct.toFixed(1)}%)`);
    tInsights.push(`→ Common entry mistakes: dry peeking, poor timing, or fighting at CT's preferred angles`);
    tDrills.push('Never take opening duels without utility - buy flash/smoke every round, use before peeking');
    tDrills.push('Learn off-angle entries: peek from unexpected positions to catch CTs off-guard');
    ctDrills.push('Practice jiggle peeking: gather info before committing to the duel');
    tResourceTags.push('t_entry', 'pop_flashes', 'shoulder_peeking', 't_utility');
  }
  
  // Economic round context
  if (ctOpeningPct < 40 && ctAggressionPct > 45) {
    ctInsights.push(`CT economy optimization needed - aggressive plays (${ctAggressionPct.toFixed(1)}% success) may cost crucial rounds`);
    ctInsights.push(`→ On force-buy/eco rounds: play even more passively, preserve utility and positioning`);
    ctDrills.push('Adjust aggression based on round type: save aggressive plays for full-buy rounds only');
    ctDrills.push('On eco defense: stack sites, play for multi-kills with utility rather than individual duels');
    ctResourceTags.push('flash_buying', 'ct_fundamentals');
  }
  
  if (tOpeningPct < 40 && tAggressionPct < 35) {
    tInsights.push(`T-side execution needs economic awareness - both opening (${tOpeningPct.toFixed(1)}%) and entries (${tAggressionPct.toFixed(1)}%) are weak`);
    tInsights.push(`→ On eco rounds: coordinate team rushes, avoid isolated 1v1s that give CTs easy trades`);
    tDrills.push('Learn eco round tactics: 5-man rushes with coordinated utility to overwhelm sites');
    tDrills.push('On force-buy rounds: play for picks with upgraded pistols, avoid committing to site executes');
    tResourceTags.push('flash_buying', 'communication', 't_fundamentals');
  }

  return { ctInsights, tInsights, ctDrills, tDrills, ctResourceTags, tResourceTags };
}

export function analysePositioning(stats: RawLeetifyProfile['stats'], rating: number, weakSide?: 'CT' | 'T' | null, benchmarkTier?: any): ImprovementArea {
  const issues: string[] = [];
  const drills: string[] = [];
  const resourceTags: string[] = [];

  if (!compareAgainstBenchmark(stats.ct_opening_duel_success_percentage, 'ct_opening_duel_success_percentage', 'profile')) {
    if (weakSide === 'CT') {
      issues.push(`Your CT side is your weak point — CT opening duels failing at ${formatApiValueAsPercentage(stats.ct_opening_duel_success_percentage, 'ct_opening_duel_success_percentage', 'profile')}`);
      drills.push('Focus CT practice: play retake servers and learn 2 off-angles per site on your main maps');
      drills.push('Study CT positioning guides - your aim isn\'t the problem, your angles are');
    } else {
      issues.push(`Losing CT opening duels too often (${formatApiValueAsPercentage(stats.ct_opening_duel_success_percentage, 'ct_opening_duel_success_percentage', 'profile')} success)`);
      drills.push('Play tighter angles on CT — wide peeking on CT side is almost always wrong at non-pro level');
    }
    drills.push('Learn 2-3 "safe" spots per site per map that give you an angle advantage, not information');
    resourceTags.push('ct_angles', 'ct_positioning');
  }

  if (!compareAgainstBenchmark(stats.t_opening_duel_success_percentage, 't_opening_duel_success_percentage', 'profile')) {
    if (weakSide === 'T') {
      issues.push(`Your T side is your bottleneck — T opening duels failing at ${formatApiValueAsPercentage(stats.t_opening_duel_success_percentage, 't_opening_duel_success_percentage', 'profile')}`);
      drills.push('Practice T-side entry routes specifically — pick one map and learn 3 entry executes with utility');
      drills.push('Focus on T positioning fundamentals - you need better timing and utility support');
    } else {
      issues.push(`Losing T-side opening duels (${formatApiValueAsPercentage(stats.t_opening_duel_success_percentage, 't_opening_duel_success_percentage', 'profile')} success)`);
      drills.push('Stop peeking without information — use utility or teammates to take space, don\'t lone-wolf it');
    }
    drills.push('Learn when to shoulder peek vs full peek — shoulder peeking costs nothing and gives info');
    resourceTags.push('t_entry', 'shoulder_peeking', 't_positioning');
  }

  if (!compareAgainstBenchmark(stats.traded_deaths_success_percentage, 'traded_deaths_success_percentage', 'profile')) {
    issues.push(`Not getting traded when you die (${formatApiValueAsPercentage(stats.traded_deaths_success_percentage, 'traded_deaths_success_percentage', 'profile')} of deaths traded)`);
    drills.push('Communicate before peeking — tell teammates where you\'re going so they can trade you');
    drills.push('Don\'t peek alone deep into the map, play closer to teammates so dying costs the enemy something');
    resourceTags.push('trade_positioning', 'communication');
  }

  if (issues.length === 0) {
    // Don't flag positioning as an issue if fundamentals are actually solid
    const difference = rating - benchmarkTier.ratings.positioning;
    const performance = difference >= 15 ? 'excellent' : difference >= 5 ? 'good' : 'solid';
    return {
      category: 'Positioning',
      rating,
      emoji: '🗺️',
      issues: [`Positioning is ${performance} (${rating}/100)`],
      drills: [],
      resourceTags: []
    };
  }

  return {
    category: 'Positioning',
    rating,
    emoji: '🗺️',
    issues,
    drills,
    resourceTags
  };
}

export function analyseUtility(stats: RawLeetifyProfile['stats'], rating: number, benchmarkTier: any): ImprovementArea {
  const issues: string[] = [];
  const drills: string[] = [];
  const resourceTags: string[] = [];

  if (!compareAgainstBenchmark(stats.flashbang_hit_friend_per_flashbang, 'flashbang_hit_friend_per_flashbang', 'profile')) {
    issues.push(`Teamflashing too much (${stats.flashbang_hit_friend_per_flashbang.toFixed(2)} teammates per flash)`);
    drills.push('Learn "pop flashes" — these curve around corners and only blind enemies facing the angle');
    drills.push('Never throw a flash without knowing where your teammates are');
    resourceTags.push('pop_flashes');
  }

  if (!compareAgainstBenchmark(stats.flashbang_hit_foe_per_flashbang, 'flashbang_hit_foe_per_flashbang', 'profile')) {
    issues.push(`Flashes aren't hitting enemies (${stats.flashbang_hit_foe_per_flashbang.toFixed(2)} enemies per flash)`);
    drills.push('Learn 2-3 flash lineups per site on your most played map — random flashes do nothing');
    drills.push('Flash BEFORE peeking, not at the same time — give the blind time to land first');
    resourceTags.push('pop_flashes', 'flash_timing');
  }

  if (!compareAgainstBenchmark(stats.flashbang_leading_to_kill, 'flashbang_leading_to_kill', 'profile')) {
    issues.push(`Flashes rarely converting to kills (${formatApiValueAsPercentage(stats.flashbang_leading_to_kill, 'flashbang_leading_to_kill', 'profile')} conversion)`);
    drills.push('Coordinate flashes with a teammate — one flashes, one peeks immediately after');
    drills.push('Self-flash into site more on T-side rather than expecting someone else to flash for you');
    resourceTags.push('flash_timing');
  }

  // flash blind duration — compound check with hit rate
  if (compareAgainstBenchmark(stats.flashbang_hit_foe_per_flashbang, 'flashbang_hit_foe_per_flashbang', 'profile')
      && !compareAgainstBenchmark(stats.flashbang_hit_foe_avg_duration, 'flashbang_hit_foe_avg_duration', 'profile')) {
    issues.push(`Your flashes reach enemies but they dodge them quickly (${stats.flashbang_hit_foe_avg_duration.toFixed(1)}s avg blind)`);
    drills.push('Switch from high-arc flashes to pop flashes — they give enemies less time to turn away');
    resourceTags.push('pop_flashes');
  } else if (!compareAgainstBenchmark(stats.flashbang_hit_foe_avg_duration, 'flashbang_hit_foe_avg_duration', 'profile')) {
    issues.push(`Flashes only blind enemies for ${stats.flashbang_hit_foe_avg_duration.toFixed(1)}s avg (aim for 1.5s+)`);
    drills.push('Learn pop flashes that detonate around corners with no time to react');
    resourceTags.push('pop_flashes');
  }

  if (!compareAgainstBenchmark(stats.flashbang_thrown, 'flashbang_thrown', 'profile')) {
    issues.push(`Throwing very few flashes per round (${stats.flashbang_thrown.toFixed(1)} avg — aim for 1.0+)`);
    drills.push('Buy flashes every round — they are the best utility in CS2 at $200. Two flashes > one HE in most situations');
    resourceTags.push('flash_buying');
  }

  if (!compareAgainstBenchmark(stats.he_foes_damage_avg, 'he_foes_damage_avg', 'profile')) {
    issues.push(`HE grenades doing barely any damage (${stats.he_foes_damage_avg.toFixed(1)} avg damage to enemies)`);
    drills.push('Learn 1-2 HE lineups per map — throwing HEs randomly is mostly a waste of money');
    drills.push('HEs work best on clustered enemies — save them for known spots (B apartments, etc)');
    resourceTags.push('he_grenades');
  }

  if (!compareAgainstBenchmark(stats.trade_kills_success_percentage, 'trade_kills_success_percentage', 'profile')) {
    issues.push(`Not converting trade kill opportunities (${formatApiValueAsPercentage(stats.trade_kills_success_percentage, 'trade_kills_success_percentage', 'profile')} success)`);
    drills.push('When a teammate gets killed, immediately check the angle they died from — that\'s your trade');
    drills.push('Don\'t panic spray from far away when trading — get closer or use a different angle');
    resourceTags.push('trade_positioning');
  }

  if (!compareAgainstBenchmark(stats.utility_on_death_avg, 'utility_on_death_avg', 'profile')) {
    issues.push(`Dying with too many nades (avg ${stats.utility_on_death_avg.toFixed(0)} value on death)`);
    drills.push('Throw your nades earlier — if you have a smoke, throw it before the fight, not during');
    drills.push('Don\'t save utility for "the right moment", that moment often doesn\'t come');
    resourceTags.push('utility_timing');
  }

  if (issues.length === 0) {
    const difference = rating - benchmarkTier.ratings.utility;
    const performance = difference >= 15 ? 'excellent' : difference >= 5 ? 'good' : 'solid';
    issues.push(`Utility usage is ${performance} (${rating}/100)`);
  }

  return {
    category: 'Utility',
    rating,
    emoji: '💣',
    issues,
    drills,
    resourceTags
  };
}

export function analyseOpening(stats: RawLeetifyProfile['stats'], rating: number, weakSide?: 'CT' | 'T' | null, benchmarkTier?: any): ImprovementArea {
  const issues: string[] = [];
  const drills: string[] = [];
  const resourceTags: string[] = [];

  const ctSuccessLow = !compareAgainstBenchmark(stats.ct_opening_aggression_success_rate, 'ct_opening_aggression_success_rate', 'profile', benchmarkTier);
  const tSuccessLow = !compareAgainstBenchmark(stats.t_opening_aggression_success_rate, 't_opening_aggression_success_rate', 'profile', benchmarkTier);

  if (ctSuccessLow) {
    if (weakSide === 'CT') {
      issues.push(`CT side is dragging you down — aggression failing at ${formatApiValueAsPercentage(stats.ct_opening_aggression_success_rate, 'ct_opening_aggression_success_rate', 'profile')}`);
      drills.push('Stop pushing on CT entirely until your CT rating improves — hold angles and play for retakes');
      drills.push('Master 2-3 defensive positions per site before attempting any aggression');
    } else {
      issues.push(`CT aggression isn't working (${formatApiValueAsPercentage(stats.ct_opening_aggression_success_rate, 'ct_opening_aggression_success_rate', 'profile')} success when you push)`);
      drills.push('On CT, only push aggressively when you have information — random aggression loses rounds');
    }
    drills.push('Play passive until you hear utility, then rotate with purpose');
    resourceTags.push('ct_angles', 'ct_positioning');
  }

  if (tSuccessLow) {
    if (weakSide === 'T') {
      issues.push(`T side is your bottleneck — entry attempts failing at ${formatApiValueAsPercentage(stats.t_opening_aggression_success_rate, 't_opening_aggression_success_rate', 'profile')}`);
      drills.push('Practice T-side entry routes specifically — pick one map and learn 3 entry executes with utility');
      drills.push('Focus on T-side fundamentals: utility timing and team coordination');
    } else {
      issues.push(`T-side entries are failing (${formatApiValueAsPercentage(stats.t_opening_aggression_success_rate, 't_opening_aggression_success_rate', 'profile')} success)`);
      drills.push('Never dry peek important angles — always use a flash, smoke, or HE to take space');
    }
    drills.push('Watch pro T-side demos on your map pool and notice how much utility they throw before peeking');
    resourceTags.push('t_entry', 'demo_review', 't_positioning');
  }

  if (!ctSuccessLow && !tSuccessLow && rating < benchmarkTier.ratings.opening && rating >= -10.0) {
    const difference = rating - benchmarkTier.ratings.opening;
    const performance = difference >= 5 ? 'excellent' : difference >= 0 ? 'good' : difference >= -5 ? 'below average' : 'poor';
    issues.push(`Opening rating is ${performance} (${formatLeetifyRating(rating)}) but individual duel success is ok — you may be taking too few opening duels`);
    drills.push('Step up as entry fragger more — if you win duels when you peek, peek more often with utility support');
    resourceTags.push('entry_fragger');
  } else if (rating < -10.0) {
    issues.push(`Opening rating is extremely low (${formatLeetifyRating(rating)}) — this may indicate you rarely take opening duels`);
    drills.push('Focus on fundamentals first (aim, positioning, utility) before worrying about entry fragging');
  }

  if (issues.length === 0) {
    const difference = rating - BENCHMARK_DECIMALS.ratings.opening;
    const performance = difference >= 5 ? 'excellent' : difference >= 0 ? 'good' : difference >= -5 ? 'below average' : 'poor';
    issues.push(`Opening performance is ${performance} (${formatLeetifyRating(rating)})`);
  }

  return {
    category: 'Opening Duels',
    rating,
    emoji: '⚔️',
    issues,
    drills,
    resourceTags
  };
}

export function analyseClutch(stats: RawLeetifyProfile['stats'], rating: number, benchmarkTier: any): ImprovementArea {
  const issues: string[] = [];
  const drills: string[] = [];
  const resourceTags: string[] = [];
  
  const ratingDisplay = formatLeetifyRating(rating);
  const ratingLevel = getLeetifyRatingLevel(rating);

  // clutch rating being low without specific sub-stats to diagnose
  if (rating < -10.0) {
    issues.push(`Clutch rating is extremely low (${ratingDisplay}) — this suggests very few clutch attempts or poor performance`);
    drills.push('Focus on staying alive longer and getting into more clutch situations through better positioning');
    resourceTags.push('clutch_fundamentals');
  } else if (rating < -6.0) {
    issues.push(`Clutch rating is very low (${ratingDisplay}) — losing most 1vX situations badly`);
    drills.push('In clutches, stop and think before moving — map out where enemies could be and make a plan');
    drills.push('Use sound — listen for footsteps and utility before peeking, time is usually on your side');
    drills.push('1v1 clutch tip: fake a site, listen for rotate, retake original site');
    resourceTags.push('clutch_fundamentals', '1v1_clutch');
  } else if (rating < benchmarkTier.ratings.clutch) {
    const difference = rating - benchmarkTier.ratings.clutch;
    const performance = difference >= -2 ? 'slightly below average' : difference >= -5 ? 'below average' : 'poor';
    issues.push(`Clutch performance is ${performance} (${ratingDisplay}) — room for improvement`);
    drills.push('Learn to use the bomb timer — planted bomb forces enemies to commit, buying you time');
    drills.push('Practice staying calm in 1vX scenarios — the mental pressure is often the main barrier');
    resourceTags.push('clutch_fundamentals');
  }

  if (!compareAgainstBenchmark(stats.utility_on_death_avg, 'utility_on_death_avg', 'profile')) {
    issues.push('Dying with utility in clutch situations wastes potential');
    drills.push('In a clutch, throw remaining utility before peeking — a HE or flash costs nothing now');
    resourceTags.push('clutch_utility');
  }

  if (issues.length === 0) {
    const difference = rating - benchmarkTier.ratings.clutch;
    const performance = difference >= 5 ? 'excellent' : difference >= 0 ? 'good' : 'above average';
    issues.push(`Clutch performance is ${performance} (${ratingDisplay})`);
  }

  return {
    category: 'Clutch',
    rating,
    emoji: '🧠',
    issues,
    drills,
    resourceTags
  };
}

// ─── side balance ─────────────────────────────────────────────────────────────

export function analyseSideBalance(
  ctRatingRaw: number,
  tRatingRaw: number,
  stats: RawLeetifyProfile['stats']
): SideBalance {
  const gap = Math.abs(ctRatingRaw - tRatingRaw);
  if (gap < 0.02) {  // API returns decimals like 0.02 for side ratings
    return { hasSideImbalance: false, weakSide: null, advice: '' };
  }

  const weakSide = ctRatingRaw < tRatingRaw ? 'CT' : 'T';
  const strongRating = Math.max(ctRatingRaw, tRatingRaw);
  const weakRating = Math.min(ctRatingRaw, tRatingRaw);

  if (weakSide === 'CT') {
    const ctDuelPct = formatApiValueAsPercentage(stats.ct_opening_duel_success_percentage, 'ct_opening_duel_success_percentage', 'profile', 1).replace('%', '');
    return {
      hasSideImbalance: true,
      weakSide: 'CT',
      advice: `Your CT side is weaker than T side (${formatLeetifyRating(weakRating * 100)} vs ${formatLeetifyRating(strongRating * 100)}). ` +
        `CT opening duel success: ${ctDuelPct}%. ` +
        `Focus on holding angles rather than peeking, and use utility to delay pushes.`
    };
  } else {
    const tDuelPct = formatApiValueAsPercentage(stats.t_opening_duel_success_percentage, 't_opening_duel_success_percentage', 'profile', 1).replace('%', '');
    return {
      hasSideImbalance: true,
      weakSide: 'T',
      advice: `Your T side is weaker than CT side (${formatLeetifyRating(weakRating * 100)} vs ${formatLeetifyRating(strongRating * 100)}). ` +
        `T opening duel success: ${tDuelPct}%. ` +
        `Use more utility before peeking on T side and practice entry routes on your map pool.`
    };
  }
}

// ─── cross-category insights ────────────────────────────────────────────────

export function detectCrossInsights(
  ratings: Record<string, number>,
  stats: RawLeetifyProfile['stats']
): CrossInsight[] {
  const insights: CrossInsight[] = [];

  if (ratings.aim >= 55 && ratings.opening < -2.0) {
    insights.push({
      label: 'Good aim but poor openings',
      detail: 'Your mechanics are fine but you lose opening duels — this usually means bad positioning when taking fights, not bad aim. Peek from off-angles and use utility to isolate 1v1s.'
    });
  }

  if (ratings.aim >= 55 && ratings.clutch < -6.0) {
    insights.push({
      label: 'Aim is there but clutches fail',
      detail: 'You can shoot but struggle in 1vX. Focus on slowing down in clutch situations — check minimap, listen for info, and take fights one at a time instead of rushing.'
    });
  }

  if (ratings.utility < 40 && ratings.opening >= 0.0) {
    insights.push({
      label: 'Winning fights without utility',
      detail: 'You win duels but don\'t use utility — this works at lower ranks but will plateau. Start using flashes before every peek to make your already-good entries even better.'
    });
  }

  if (!compareAgainstBenchmark(stats.he_friends_damage_avg, 'he_friends_damage_avg', 'profile')) {
    insights.push({
      label: 'Friendly fire with HE grenades',
      detail: `You deal ${stats.he_friends_damage_avg.toFixed(1)} avg HE damage to teammates. Check teammate positions before throwing HEs, especially in close-quarters sites.`
    });
  }

  if (!compareAgainstBenchmark(stats.trade_kill_opportunities_per_round, 'trade_kill_opportunities_per_round', 'profile')) {
    insights.push({
      label: 'Isolated from teammates',
      detail: `You only get ${stats.trade_kill_opportunities_per_round.toFixed(2)} trade opportunities per round — you're playing too far from teammates. Stay closer so deaths can be traded.`
    });
  }

  return insights;
}

// ─── resource selection ─────────────────────────────────────────────────────

export function selectTopResources(
  focusAreas: ImprovementArea[],
  sideInsights: SideSpecificInsights
): SelectedResource[] {
  // Collect all resource tags with priorities
  const resourceTagCounts = new Map<string, number>();
  
  // Focus areas get highest priority (weight: 3)
  focusAreas.forEach(area => {
    area.resourceTags.forEach(tag => {
      resourceTagCounts.set(tag, (resourceTagCounts.get(tag) || 0) + 3);
    });
  });
  
  // Side-specific tags get medium priority (weight: 2)
  [...sideInsights.ctResourceTags, ...sideInsights.tResourceTags].forEach(tag => {
    resourceTagCounts.set(tag, (resourceTagCounts.get(tag) || 0) + 2);
  });
  
  // Prioritize broader categories over specific ones
  const categoryPriority: Record<string, number> = {
    'clutch_fundamentals': 10,
    'ct_fundamentals': 10, 
    't_fundamentals': 10,
    'aim_accuracy': 9,
    'crosshair_placement': 9,
    'ct_positioning': 8,
    't_positioning': 8,
    'ct_angles': 7,
    't_entry': 7,
    'pop_flashes': 6,
    'spray_control': 6,
    'counter_strafing': 6,
    'clutch_utility': 5, // Lower priority than clutch_fundamentals
    '1v1_clutch': 4,     // Lower priority than clutch_fundamentals
    'flash_timing': 4,
    'trade_positioning': 4,
  };
  
  // Sort by combined priority score and category priority
  const sortedTags = Array.from(resourceTagCounts.entries())
    .map(([tag, count]) => ({
      tag,
      score: count + (categoryPriority[tag] || 0)
    }))
    .sort((a, b) => b.score - a.score)
    .map(({tag}) => tag);
  
  const selectedResources: SelectedResource[] = [];
  const usedUrls = new Set<string>();
  const usedRootCategories = new Set<string>();
  
  for (const tag of sortedTags) {
    if (selectedResources.length >= 4) break;
    
    const resourceList = resources[tag];
    if (!resourceList || resourceList.length === 0) continue;
    
    // Skip subcategories if we already have the main category
    const rootCategory = tag.split('_')[0]; // 'clutch' from 'clutch_utility'
    if (usedRootCategories.has(rootCategory) && !['ct', 't', 'aim', 'flash'].includes(rootCategory)) {
      continue;
    }
    
    // Find best resource that we haven't used yet
    let bestResource = resourceList.find(r => 
      !usedUrls.has(r.link) && (r.type === 'youtube' || r.type === 'website')
    );
    if (!bestResource) {
      bestResource = resourceList.find(r => !usedUrls.has(r.link));
    }
    
    if (bestResource) {
      const emoji = bestResource.type === 'youtube' ? '🎥' 
        : bestResource.type === 'website' ? '🌐' 
        : bestResource.type === 'workshop' ? '🗺️' 
        : '📖';
      
      selectedResources.push({
        title: tag.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        link: bestResource.link,
        emoji,
        description: bestResource.description || 'Practice resource'
      });
      
      usedUrls.add(bestResource.link);
      usedRootCategories.add(rootCategory);
    }
  }
  
  return selectedResources;
}

// ─── main analysis function ──────────────────────────────────────────────────

export function buildImprovementReport(rawProfile: RawLeetifyProfile): ImprovementReport {
  const { rating, stats, name } = rawProfile;

  // Get appropriate benchmark tier based on Premier rating
  const premierRating = rawProfile.ranks?.premier;
  const benchmarkTier = getBenchmarkTier(premierRating);

  // Mixed rating system: aim/utility/positioning use 0-100, clutch/opening use relative values
  const to100 = (v: number) => Math.round(v > 1 ? v : v * 100);
  const ratings = {
    aim: to100(rating.aim || 0),        // 0-100 scale
    positioning: to100(rating.positioning || 0), // 0-100 scale  
    utility: to100(rating.utility || 0), // 0-100 scale
    clutch: (rating.clutch || 0) * 100,    // Convert API decimal (0.0961) to display format (9.61)
    opening: (rating.opening || 0) * 100,  // Convert API decimal (0.0438) to display format (4.38)
  };

  const ctRating = rating.ct_leetify || 0;
  const tRating = rating.t_leetify || 0;

  // Use raw values for more meaningful analysis 
  const ctRatingRaw = rating.ct_leetify || 0;
  const tRatingRaw = rating.t_leetify || 0;
  const sideBalance = analyseSideBalance(ctRatingRaw, tRatingRaw, stats);
  const sideInsights = analyzeCTTSideWeaknesses(stats, ctRatingRaw, tRatingRaw);

  const areas = [
    analyseAim(stats, ratings.aim, benchmarkTier),
    analysePositioning(stats, ratings.positioning, sideBalance.weakSide, benchmarkTier),
    analyseUtility(stats, ratings.utility, benchmarkTier),
    analyseOpening(stats, ratings.opening, sideBalance.weakSide, benchmarkTier),
    analyseClutch(stats, ratings.clutch, benchmarkTier),
  ];

  // sort by rating ascending — worst first
  areas.sort((a, b) => a.rating - b.rating);

  // Build focus areas with better prioritization - include low-performing areas
  let focusAreas: ImprovementArea[] = [];
  
  // Step 1: Always include critically low areas regardless of category
  const criticalAreas = areas.filter(a => {
    const isCritical = (a.category === 'Clutch' || a.category === 'Opening Duels') 
      ? a.rating < -6.0  // Relative ratings (proper scale)
      : a.rating < 30;   // 0-100 ratings
    return isCritical && 
      a.issues.length > 0 &&
      !a.issues[0].includes('solid') &&
      !a.issues[0].includes('good');
  });
  
  focusAreas.push(...criticalAreas.slice(0, 3));
  
  // Step 2: Add positioning if side imbalance exists
  if (sideBalance.hasSideImbalance && focusAreas.length < 3) {
    const positioningArea = areas.find(a => a.category === 'Positioning');
    if (positioningArea && !focusAreas.includes(positioningArea)) {
      focusAreas.push(positioningArea);
    }
  }
  
  // Step 3: Fill remaining slots with next worst areas
  if (focusAreas.length < 3) {
    const remainingAreas = areas.filter(a => 
      !focusAreas.includes(a) &&
      a.rating < 65 &&
      a.issues.length > 0 &&
      !a.issues[0].includes('solid') &&
      !a.issues[0].includes('good')
    );
    
    focusAreas.push(...remainingAreas.slice(0, 3 - focusAreas.length));
  }

  // fallback if we still don't have enough focus areas
  if (focusAreas.length === 0) {
    // Show the worst performing areas regardless of thresholds
    focusAreas.push(...areas.slice(0, 3));
  }

  // Ensure we have at least the worst area
  if (focusAreas.length === 0) {
    focusAreas.push(areas[0]);
  }

  const crossInsights = detectCrossInsights(ratings, stats);

  return { areas, focusAreas, playerName: name, sideBalance, crossInsights, sideInsights };
}