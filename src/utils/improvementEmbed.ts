/**
 * Discord embed builder for CS2 improvement reports
 * Handles all Discord embed formatting and presentation logic
 */

import { EmbedBuilder } from 'discord.js';
import { 
  BENCHMARK_DECIMALS,
  getBenchmarkTier,
  formatLeetifyRating,
  getLeetifyRatingLevel,
} from './dataFormatter';
import { selectTopResources } from './cs2Analysis';
import type {
  ImprovementReport,
  RawLeetifyProfile
} from '../types/improvement';

// ─── benchmark helpers ──────────────────────────────────────────────────────

/**
 * Get trend emoji and benchmark comparison for a rating
 * Shows how player compares to skill-level appropriate benchmarks
 * Format: "(+6, up 7%)" when above benchmark, "(-3, down 5%)" when below
 */
export function getRatingTrend(
  currentValue: number, 
  category: string,
  isRelativeRating: boolean = false,
  benchmarkTier?: any
): { emoji: string; trendText: string } {
  const benchmarks = benchmarkTier || BENCHMARK_DECIMALS;
  
  if (isRelativeRating) {
    // For clutch/opening relative ratings - use existing logic
    let benchmarkKey: 'clutch' | 'opening';
    if (category === 'Clutch') {
      benchmarkKey = 'clutch';
    } else if (category === 'Opening Duels') {
      benchmarkKey = 'opening';
    } else {
      // fallback for any other relative rating categories
      benchmarkKey = category.toLowerCase() as 'clutch' | 'opening';
    }
    
    const benchmark = benchmarks.ratings[benchmarkKey];
    const difference = currentValue - benchmark;
    
    // For relative ratings, don't calculate percentages - they're meaningless near zero
    if (difference > 2.0) {
      return { 
        emoji: '🔥', 
        trendText: `(${formatLeetifyRating(difference)} above avg)` 
      };
    } else if (difference > 0) {
      return { 
        emoji: '✨', 
        trendText: `(${formatLeetifyRating(difference)} above avg)` 
      };
    } else if (difference > -3.0) {
      return { 
        emoji: '👍', 
        trendText: `(${formatLeetifyRating(difference)} below avg)` 
      };
    } else {
      return { 
        emoji: '📉', 
        trendText: `(${formatLeetifyRating(difference)} below avg)` 
      };
    }
  } else {
    // For 0-100 ratings, calculate difference from benchmark
    const benchmarkKey = category.toLowerCase() as 'aim' | 'positioning' | 'utility';
    const benchmark = benchmarks.ratings[benchmarkKey];
    const difference = currentValue - benchmark;
    const percentDiff = Math.round((Math.abs(difference) / benchmark) * 100);
    
    if (currentValue >= benchmark + 20) {
      return { emoji: '🔥', trendText: `(+${Math.round(difference)}, up ${percentDiff}%)` };
    } else if (currentValue >= benchmark + 10) {
      return { emoji: '✨', trendText: `(+${Math.round(difference)}, up ${percentDiff}%)` };
    } else if (currentValue >= benchmark) {
      return { emoji: '👍', trendText: `(+${Math.round(difference)}, up ${percentDiff}%)` };
    } else if (currentValue >= benchmark - 10) {
      return { emoji: '👎', trendText: `(${Math.round(difference)}, down ${percentDiff}%)` };
    } else {
      return { emoji: '💀', trendText: `(${Math.round(difference)}, down ${percentDiff}%)` };
    }
  }
}

// ─── embed builder ───────────────────────────────────────────────────────────

export function buildImprovementEmbed(
  report: ImprovementReport,
  steamId: string,
  rawProfile: RawLeetifyProfile
): EmbedBuilder {
  const { focusAreas, areas, playerName, sideBalance, crossInsights, sideInsights } = report;

  // Get appropriate benchmark tier for this player
  const premierRating = rawProfile.ranks?.premier;
  const benchmarkTier = getBenchmarkTier(premierRating);

  // color based on how bad the worst rating is (need to handle mixed rating scales)
  const worstArea = areas[0]; // Already sorted by rating ascending
  let embedColor: number;
  
  if (worstArea.category === 'Clutch' || worstArea.category === 'Opening Duels') {
    // Relative rating scale
    embedColor = worstArea.rating < -8.0 ? 0xFF0000  // Red for very poor
      : worstArea.rating < -3.0 ? 0xFFA500   // Orange for poor  
      : worstArea.rating < 2.0 ? 0xFFFF00    // Yellow for below average
      : 0x00FF00;  // Green for good
  } else {
    // 0-100 rating scale
    embedColor = worstArea.rating < 30 ? 0xFF0000
      : worstArea.rating < 45 ? 0xFFA500
      : worstArea.rating < 60 ? 0xFFFF00
      : 0x00FF00;
  }

  const embed = new EmbedBuilder()
    .setColor(embedColor)
    .setTitle(`📈 ${playerName}'s Improvement Report`)
    .setURL(`https://leetify.com/app/profile/${steamId}`)

  // Build description with rank and focus areas
  let description = '';
  
  // Add rank information if available
  if (rawProfile.ranks?.premier) {
    description += `**Premier Rank:** ${rawProfile.ranks.premier.toLocaleString()}\n`;
  } else if (rawProfile.ranks?.leetify) {
    description += `**Leetify Rating:** ${rawProfile.ranks.leetify}\n`;
  }
  
  description += `Based on your last 30 games. **${focusAreas.length} key area${focusAreas.length !== 1 ? 's' : ''}** need attention:`;
  
  embed.setDescription(description);

  // rating overview — all 5 categories at a glance + CT/T ratings with enhanced trend indicators
  const ratingBar = areas.map(a => {
    let ratingDisplay: string;
    let trendInfo: { emoji: string; trendText: string };
    
    if (a.category === 'Clutch' || a.category === 'Opening Duels') {
      // Relative ratings
      ratingDisplay = formatLeetifyRating(a.rating);
      trendInfo = getRatingTrend(a.rating, a.category, true, benchmarkTier);
    } else {
      // 0-100 ratings
      ratingDisplay = `${Math.round(a.rating)}/100`;
      trendInfo = getRatingTrend(a.rating, a.category, false, benchmarkTier);
    }
    
    return `${trendInfo.emoji} **${a.category}**: ${ratingDisplay} ${trendInfo.trendText}`;
  }).join('\n');
  
  // Add CT/T side ratings to the overview with traffic light system
  const ctLeetifyRaw = rawProfile.rating.ct_leetify || 0;
  const tLeetifyRaw = rawProfile.rating.t_leetify || 0;
  
  // Convert raw leetify ratings to enhanced descriptions with improved emoji system
  function getSideRatingDisplay(rating: number): { emoji: string; description: string; display: string } {
    // Convert API decimal (0.014) to display format (1.4)
    const displayValue = rating * 100;
    const formatted = formatLeetifyRating(displayValue);
    
    if (displayValue >= 5.0) return { emoji: '🔥', description: 'Excellent performance', display: formatted };
    if (displayValue >= 0.0) return { emoji: '✨', description: 'Good performance', display: formatted };
    if (displayValue >= -3.0) return { emoji: '👍', description: 'Average performance', display: formatted };
    if (displayValue >= -6.0) return { emoji: '👎', description: 'Below average', display: formatted };
    return { emoji: '💀', description: 'Needs improvement', display: formatted };
  }
    
  const sideRatings = [];
  if (ctLeetifyRaw !== 0) {
    const ctRating = getSideRatingDisplay(ctLeetifyRaw);
    sideRatings.push(`${ctRating.emoji} **CT Side**: ${ctRating.description} (${ctRating.display})`);
  }
  if (tLeetifyRaw !== 0) {
    const tRating = getSideRatingDisplay(tLeetifyRaw);
    sideRatings.push(`${tRating.emoji} **T Side**: ${tRating.description} (${tRating.display})`);
  }
  
  const fullRatingDisplay = sideRatings.length > 0 
    ? ratingBar + '\n\n**Side Ratings:**\n' + sideRatings.join('\n')
    : ratingBar;

  embed.addFields({
    name: '📊 Rating Overview',
    value: fullRatingDisplay,
    inline: false
  });

  // enhanced side analysis
  if (sideBalance.hasSideImbalance) {
    embed.addFields({
      name: `${sideBalance.weakSide === 'CT' ? '🛡️' : '⚔️'} Side Imbalance Detected`,
      value: sideBalance.advice,
      inline: false
    });
  }
  
  // Streamlined side analysis
  if (sideInsights.ctInsights.length > 0 || sideInsights.tInsights.length > 0) {
    const allInsights = [...sideInsights.ctInsights, ...sideInsights.tInsights];
    const allDrills = [...sideInsights.ctDrills, ...sideInsights.tDrills];
    
    const sideText = [
      `**Key Issues:** ${allInsights.slice(0, 3).join(' • ')}`,
      `**Practice:** ${allDrills.slice(0, 3).join(' • ')}`
    ].filter(s => !s.includes('undefined')).join('\n\n');
    
    if (sideText && sideText.length > 50) {
      embed.addFields({
        name: '🏙️ Side-Specific Analysis',
        value: sideText.slice(0, 1000),
        inline: false
      });
    }
  }
  
  // detailed breakdown for focus areas (streamlined)
  for (const area of focusAreas) {
    let ratingDisplay: string;
    let isPriority: string;
    
    if (area.category === 'Clutch' || area.category === 'Opening Duels') {
      // Relative ratings
      ratingDisplay = formatLeetifyRating(area.rating);
      isPriority = area.rating < -8.0 ? '🚨' : area.rating < -3.0 ? '⚠️' : '📈';
    } else {
      // 0-100 ratings
      ratingDisplay = `${Math.round(area.rating)}/100`;
      isPriority = area.rating < 30 ? '🚨' : area.rating < 45 ? '⚠️' : '📈';
    }
    
    const issueText = area.issues.slice(0, 2).map(i => `• ${i}`).join('\n');
    const drillText = area.drills.length > 0
      ? '\n\n**Quick Fixes:**\n' + area.drills.slice(0, 2).map(d => `→ ${d}`).join('\n')
      : '';

    // More concise field value
    let fieldValue = issueText + drillText;
    if (fieldValue.length > 900) {
      fieldValue = area.issues.slice(0, 1).join('') + '\n\n**Quick Fix:** ' + area.drills[0];
    }

    embed.addFields({
      name: `${isPriority} ${area.emoji} ${area.category} — ${ratingDisplay}`,
      value: fieldValue,
      inline: false
    });
  }

  // cross-category insights
  if (crossInsights.length > 0) {
    const insightText = crossInsights
      .slice(0, 2)
      .map(i => `**${i.label}:** ${i.detail}`)
      .join('\n\n');

    embed.addFields({
      name: '🔗 Connected Patterns',
      value: insightText,
      inline: false
    });
  }

  // what's going well
  const goodAreas = areas
    .filter(a => a.rating >= 60)
    .map(a => {
      if (a.category === 'Clutch' || a.category === 'Opening Duels') {
        return `${a.emoji} ${a.category} (${formatLeetifyRating(a.rating)})`;
      } else {
        return `${a.emoji} ${a.category} (${Math.round(a.rating * 10) / 10}/100)`;
      }
    })
    .join(' • ');

  if (goodAreas) {
    embed.addFields({
      name: '✅ What\'s Working',
      value: goodAreas,
      inline: false
    });
  }

  // Practice resources section
  const topResources = selectTopResources(focusAreas, sideInsights);
  if (topResources.length > 0) {
    const resourceText = topResources
      .map(r => `${r.emoji} **[${r.title}](${r.link})** - ${r.description}`)
      .join('\n');
    
    embed.addFields({
      name: '📚 Practice Resources',
      value: resourceText,
      inline: false
    });
  }

  embed.setFooter({
    text: 'Last 30 competitive matches • Powered by Leetify API'
  }).setTimestamp();

  return embed;
}