import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder, MessageFlags } from 'discord.js';
import { Command } from '../handlers/commandHandler';
import { database } from '../database/database';
import { validateAndNormalizeSteamId } from '../utils/steam';
import { leetifyApi } from '../services/leetify';
import { logger } from '../utils/logger';

// ─── types ───────────────────────────────────────────────────────────────────

interface RawLeetifyProfile {
  name: string;
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

interface ImprovementArea {
  category: string;
  rating: number;       // 0-100 leetify rating
  emoji: string;
  issues: string[];     // specific sub-metric issues detected
  drills: string[];     // actionable practice suggestions
}

// ─── benchmarks ──────────────────────────────────────────────────────────────
// based on what leetify shows as "average" for mid-level players

const BENCHMARKS = {
  // rating thresholds - below these = flagged
  ratings: {
    aim: 45,
    positioning: 45,
    utility: 45,
    clutch: 45,
    opening: 45,
  },
  // sub-stat thresholds
  stats: {
    accuracy_enemy_spotted: 0.18,       // 18% - below this is rough
    counter_strafing_good_shots_ratio: 0.55,  // 55% good shots while strafing
    ct_opening_duel_success_percentage: 0.45, // 45% CT duel success
    t_opening_duel_success_percentage: 0.45,  // 45% T duel success
    flashbang_hit_foe_per_flashbang: 0.6,     // hitting <0.6 enemies per flash
    flashbang_hit_friend_per_flashbang: 0.3,  // teamflashing more than 0.3/flash
    flashbang_leading_to_kill: 0.15,          // <15% flashes lead to kills
    he_foes_damage_avg: 20,                   // <20 HE damage to enemies avg
    utility_on_death_avg: 200,                // dying with >200 value in nades
    traded_deaths_success_percentage: 0.45,   // getting traded <45% of deaths
    trade_kills_success_percentage: 0.45,     // converting trade kills <45%
    preaim: 0.5,                              // preaim score below 0.5
    spray_accuracy: 0.35,                     // spray control below 35%
    reaction_time_ms: 350,                    // reaction time above 350ms
  }
};

// ─── advice engine ───────────────────────────────────────────────────────────

function analyseAim(stats: RawLeetifyProfile['stats'], rating: number): ImprovementArea {
  const issues: string[] = [];
  const drills: string[] = [];

  if (stats.accuracy_enemy_spotted < BENCHMARKS.stats.accuracy_enemy_spotted) {
    issues.push(`Low accuracy when enemy spotted (${(stats.accuracy_enemy_spotted * 100).toFixed(1)}% — aim for 18%+)`);
    drills.push('aim_botz — 100 kills at close/medium range daily, focus on crosshair placement not speed');
  }

  if (stats.counter_strafing_good_shots_ratio < BENCHMARKS.stats.counter_strafing_good_shots_ratio) {
    issues.push(`You're firing while still moving too often (${(stats.counter_strafing_good_shots_ratio * 100).toFixed(1)}% clean shots)`);
    drills.push('counter_strafing workshop map — only shoot when fully stopped, build the habit before worrying about speed');
  }

  if (stats.spray_accuracy < BENCHMARKS.stats.spray_accuracy) {
    issues.push(`Spray control is weak (${(stats.spray_accuracy * 100).toFixed(1)}% accuracy in sprays)`);
    drills.push('recoil master workshop — learn AK and M4 spray patterns, 15 mins a day for 2 weeks will fix this');
  }

  if (stats.preaim < BENCHMARKS.stats.preaim) {
    issues.push(`Not pre-aiming common angles (preaim score: ${stats.preaim.toFixed(2)})`);
    drills.push('deathmatch on your most played map — move crosshair to head height on every corner BEFORE you see anyone');
  }

  if (stats.reaction_time_ms > BENCHMARKS.stats.reaction_time_ms) {
    issues.push(`Reaction time is slow (${stats.reaction_time_ms.toFixed(0)}ms avg — aim for sub-350ms)`);
    drills.push('aim_botz reflex training — 200 kills, reaction mode. Also check your monitor refresh rate and in-game sensitivity');
  }

  if (issues.length === 0) {
    issues.push('Aim fundamentals are solid');
  }

  return {
    category: 'Aim',
    rating,
    emoji: '🎯',
    issues,
    drills
  };
}

function analysePositioning(stats: RawLeetifyProfile['stats'], rating: number): ImprovementArea {
  const issues: string[] = [];
  const drills: string[] = [];

  if (stats.ct_opening_duel_success_percentage < BENCHMARKS.stats.ct_opening_duel_success_percentage) {
    issues.push(`Losing CT opening duels too often (${(stats.ct_opening_duel_success_percentage * 100).toFixed(1)}% success)`);
    drills.push('Play tighter angles on CT — wide peeking on CT side is almost always wrong at non-pro level');
    drills.push('Learn 2-3 "safe" spots per site per map that give you an angle advantage, not information');
  }

  if (stats.t_opening_duel_success_percentage < BENCHMARKS.stats.t_opening_duel_success_percentage) {
    issues.push(`Losing T-side opening duels (${(stats.t_opening_duel_success_percentage * 100).toFixed(1)}% success)`);
    drills.push('Stop peeking without information — use utility or teammates to take space, don\'t lone-wolf it');
    drills.push('Learn when to shoulder peek vs full peek — shoulder peeking costs nothing and gives info');
  }

  if (stats.traded_deaths_success_percentage < BENCHMARKS.stats.traded_deaths_success_percentage) {
    issues.push(`Not getting traded when you die (${(stats.traded_deaths_success_percentage * 100).toFixed(1)}% of deaths traded)`);
    drills.push('Communicate before peeking — tell teammates where you\'re going so they can trade you');
    drills.push('Don\'t peek alone deep into the map, play closer to teammates so dying costs the enemy something');
  }

  if (stats.utility_on_death_avg > BENCHMARKS.stats.utility_on_death_avg) {
    issues.push(`Dying with too many nades (avg ${stats.utility_on_death_avg.toFixed(0)} value on death)`);
    drills.push('Throw your nades earlier — if you have a smoke, throw it before the fight, not during');
    drills.push('Don\'t save utility for "the right moment", that moment often doesn\'t come');
  }

  if (issues.length === 0) {
    issues.push('Positioning fundamentals look solid');
  }

  return {
    category: 'Positioning',
    rating,
    emoji: '🗺️',
    issues,
    drills
  };
}

function analyseUtility(stats: RawLeetifyProfile['stats'], rating: number): ImprovementArea {
  const issues: string[] = [];
  const drills: string[] = [];

  if (stats.flashbang_hit_friend_per_flashbang > BENCHMARKS.stats.flashbang_hit_friend_per_flashbang) {
    issues.push(`Teamflashing too much (${stats.flashbang_hit_friend_per_flashbang.toFixed(2)} teammates per flash)`);
    drills.push('Learn "pop flashes" — these curve around corners and only blind enemies facing the angle');
    drills.push('Never throw a flash without knowing where your teammates are');
  }

  if (stats.flashbang_hit_foe_per_flashbang < BENCHMARKS.stats.flashbang_hit_foe_per_flashbang) {
    issues.push(`Flashes aren't hitting enemies (${stats.flashbang_hit_foe_per_flashbang.toFixed(2)} enemies per flash)`);
    drills.push('Learn 2-3 flash lineups per site on your most played map — random flashes do nothing');
    drills.push('Flash BEFORE peeking, not at the same time — give the blind time to land first');
  }

  if (stats.flashbang_leading_to_kill < BENCHMARKS.stats.flashbang_leading_to_kill) {
    issues.push(`Flashes rarely converting to kills (${(stats.flashbang_leading_to_kill * 100).toFixed(1)}% conversion)`);
    drills.push('Coordinate flashes with a teammate — one flashes, one peeks immediately after');
    drills.push('Self-flash into site more on T-side rather than expecting someone else to flash for you');
  }

  if (stats.he_foes_damage_avg < BENCHMARKS.stats.he_foes_damage_avg) {
    issues.push(`HE grenades doing barely any damage (${stats.he_foes_damage_avg.toFixed(1)} avg damage to enemies)`);
    drills.push('Learn 1-2 HE lineups per map — throwing HEs randomly is mostly a waste of money');
    drills.push('HEs work best on clustered enemies — save them for known spots (B apartments, etc)');
  }

  if (stats.trade_kills_success_percentage < BENCHMARKS.stats.trade_kills_success_percentage) {
    issues.push(`Not converting trade kill opportunities (${(stats.trade_kills_success_percentage * 100).toFixed(1)}% success)`);
    drills.push('When a teammate gets killed, immediately check the angle they died from — that\'s your trade');
    drills.push('Don\'t panic spray from far away when trading — get closer or use a different angle');
  }

  if (issues.length === 0) {
    issues.push('Utility usage is solid');
  }

  return {
    category: 'Utility',
    rating,
    emoji: '💣',
    issues,
    drills
  };
}

function analyseOpening(stats: RawLeetifyProfile['stats'], rating: number): ImprovementArea {
  const issues: string[] = [];
  const drills: string[] = [];

  const ctSuccessLow = stats.ct_opening_aggression_success_rate < BENCHMARKS.stats.ct_opening_duel_success_percentage;
  const tSuccessLow = stats.t_opening_aggression_success_rate < BENCHMARKS.stats.t_opening_duel_success_percentage;

  if (ctSuccessLow) {
    issues.push(`CT aggression isn't working (${(stats.ct_opening_aggression_success_rate * 100).toFixed(1)}% success when you push)`);
    drills.push('On CT, only push aggressively when you have information — random aggression loses rounds');
    drills.push('Play passive until you hear utility, then rotate with purpose');
  }

  if (tSuccessLow) {
    issues.push(`T-side entries are failing (${(stats.t_opening_aggression_success_rate * 100).toFixed(1)}% success)`);
    drills.push('Never dry peek important angles — always use a flash, smoke, or HE to take space');
    drills.push('Watch pro T-side demos on your map pool and notice how much utility they throw before peeking');
  }

  if (!ctSuccessLow && !tSuccessLow && rating < BENCHMARKS.ratings.opening) {
    issues.push('Opening rating is low but individual duel success is ok — you may be taking too few duels');
    drills.push('Step up as entry fragger more — if you win duels when you peek, peek more often with utility support');
  }

  if (issues.length === 0) {
    issues.push('Opening performance looks good');
  }

  return {
    category: 'Opening Duels',
    rating,
    emoji: '⚔️',
    issues,
    drills
  };
}

function analyseClutch(stats: RawLeetifyProfile['stats'], rating: number): ImprovementArea {
  const issues: string[] = [];
  const drills: string[] = [];

  // clutch rating being low without specific sub-stats to diagnose
  // so we give general advice based on how low it is
  if (rating < 35) {
    issues.push(`Clutch rating is very low (${rating}/100) — likely losing most 1vX situations`);
    drills.push('In clutches, stop and think before moving — map out where enemies could be and make a plan');
    drills.push('Use sound — listen for footsteps and utility before peeking, the clock is your enemy not your friend');
    drills.push('1v1 clutch tip: fake a site, listen for rotate, retake original site');
  } else if (rating < BENCHMARKS.ratings.clutch) {
    issues.push(`Clutch rate is below average (${rating}/100)`);
    drills.push('Learn to use the bomb — active bomb forces enemies to commit, buying you time for information');
    drills.push('Practice 1vX scenarios in workshop or deathmatch — the mental pressure is the main barrier');
  }

  if (stats.utility_on_death_avg > BENCHMARKS.stats.utility_on_death_avg) {
    issues.push('Dying with utility in clutch situations wastes potential');
    drills.push('In a clutch, throw remaining utility before peeking — a HE or flash costs nothing now');
  }

  if (issues.length === 0) {
    issues.push('Clutch performance is solid');
  }

  return {
    category: 'Clutch',
    rating,
    emoji: '🧠',
    issues,
    drills
  };
}

// ─── main analysis function ──────────────────────────────────────────────────

function buildImprovementReport(rawProfile: RawLeetifyProfile): {
  areas: ImprovementArea[];
  focusAreas: ImprovementArea[];  // worst 2-3 only
  playerName: string;
} {
  const { rating, stats, name } = rawProfile;

  // convert leetify 0-1 ratings to 0-100
  const ratings = {
    aim: Math.round((rating.aim || 0) * 100),
    positioning: Math.round((rating.positioning || 0) * 100),
    utility: Math.round((rating.utility || 0) * 100),
    clutch: Math.round((rating.clutch || 0) * 100),
    opening: Math.round((rating.opening || 0) * 100),
  };

  const areas = [
    analyseAim(stats, ratings.aim),
    analysePositioning(stats, ratings.positioning),
    analyseUtility(stats, ratings.utility),
    analyseOpening(stats, ratings.opening),
    analyseClutch(stats, ratings.clutch),
  ];

  // sort by rating ascending — worst first
  areas.sort((a, b) => a.rating - b.rating);

  // only surface the worst 3 that actually have issues
  const focusAreas = areas
    .filter(a => a.issues.length > 0 && !a.issues[0].includes('solid') && !a.issues[0].includes('good'))
    .slice(0, 3);

  // fallback if everything looks fine
  if (focusAreas.length === 0) {
    focusAreas.push(areas[0]); // still show worst area
  }

  return { areas, focusAreas, playerName: name };
}

// ─── embed builder ───────────────────────────────────────────────────────────

function buildImprovementEmbed(
  report: ReturnType<typeof buildImprovementReport>,
  steamId: string
): EmbedBuilder {
  const { focusAreas, areas, playerName } = report;

  // color based on how bad the worst rating is
  const worstRating = areas[0].rating;
  const embedColor = worstRating < 30 ? 0xFF0000
    : worstRating < 45 ? 0xFFA500
    : worstRating < 60 ? 0xFFFF00
    : 0x00FF00;

  const embed = new EmbedBuilder()
    .setColor(embedColor)
    .setTitle(`📈 ${playerName}'s Improvement Report`)
    .setURL(`https://leetify.com/app/profile/${steamId}`)
    .setDescription(
      `Based on your last 30 games. Showing your **${focusAreas.length} biggest areas to work on** — fix these before worrying about anything else.`
    );

  // rating overview — all 5 categories at a glance
  const ratingBar = areas.map(a => {
    const bar = a.rating >= 60 ? '🟢' : a.rating >= 45 ? '🟡' : '🔴';
    return `${bar} **${a.category}**: ${a.rating}/100`;
  }).join('\n');

  embed.addFields({
    name: '📊 Rating Overview',
    value: ratingBar,
    inline: false
  });

  // detailed breakdown for focus areas
  for (const area of focusAreas) {
    const issueText = area.issues.map(i => `• ${i}`).join('\n');
    const drillText = area.drills.length > 0
      ? '\n\n**How to fix it:**\n' + area.drills.map(d => `→ ${d}`).join('\n')
      : '';

    embed.addFields({
      name: `${area.emoji} ${area.category} — ${area.rating}/100`,
      value: issueText + drillText,
      inline: false
    });
  }

  // what's going well
  const goodAreas = areas
    .filter(a => a.rating >= 60)
    .map(a => `${a.emoji} ${a.category} (${a.rating}/100)`)
    .join(' • ');

  if (goodAreas) {
    embed.addFields({
      name: '✅ What\'s Working',
      value: goodAreas,
      inline: false
    });
  }

  embed.setFooter({
    text: 'Last 30 competitive matches • Powered by Leetify API'
  }).setTimestamp();

  return embed;
}

// ─── command ─────────────────────────────────────────────────────────────────

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('improve')
    .setDescription('Get a personalised improvement report based on your last 30 games')
    .addStringOption(option =>
      option
        .setName('player')
        .setDescription('Steam ID or player (leave empty to use your linked account)')
        .setRequired(false)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const playerInput = interaction.options.getString('player');
    const discordId = interaction.user.id;

    await interaction.deferReply();

    try {
      let steamId: string;

      if (playerInput) {
        const steamInfo = validateAndNormalizeSteamId(playerInput);
        if (!steamInfo.isValid) {
          const errorEmbed = new EmbedBuilder()
            .setColor(0xFF0000)
            .setTitle('❌ Invalid Steam ID')
            .setDescription(
              'Please provide a valid Steam ID format:\n' +
              '• Steam64 ID: `76561198123456789`\n' +
              '• Steam32 ID: `123456789`\n' +
              '• SteamID: `STEAM_0:1:61728394`\n' +
              '• Profile URL: `https://steamcommunity.com/profiles/76561198123456789`'
            );
          await interaction.editReply({ embeds: [errorEmbed] });
          return;
        }
        steamId = steamInfo.steam64;
      } else {
        const user = await database.getUserByDiscordId(discordId);
        if (!user) {
          const noLinkEmbed = new EmbedBuilder()
            .setColor(0xFFAAAA)
            .setTitle('🔗 No Linked Account')
            .setDescription(
              'You don\'t have a Steam account linked. Either:\n\n' +
              '• Use `/link <steam_id>` to link your account\n' +
              '• Or specify a Steam ID: `/improve <steam_id>`'
            );
          await interaction.editReply({ embeds: [noLinkEmbed] });
          return;
        }
        steamId = user.steam_id;
      }

      // hit the profile endpoint to get raw rating + stats sub-metrics
      const rawProfile: RawLeetifyProfile = await leetifyApi.getRawProfile(steamId);

      if (!rawProfile?.rating || !rawProfile?.stats) {
        const noDataEmbed = new EmbedBuilder()
          .setColor(0xFFAAAA)
          .setTitle('📊 No Data Available')
          .setDescription(
            'Could not find enough data to generate an improvement report.\n\n' +
            'Make sure this player has recent CS2 matches on Leetify.'
          );
        await interaction.editReply({ embeds: [noDataEmbed] });
        return;
      }

      const report = buildImprovementReport(rawProfile);
      const embed = buildImprovementEmbed(report, steamId);

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      logger.error('Error in improve command:', {
        error: error instanceof Error ? error.message : error,
        discordId,
        playerInput,
        stack: error instanceof Error ? error.stack : undefined
      });

      let errorMessage = 'An error occurred while generating your improvement report.';

      if (error && typeof error === 'object' && 'code' in error) {
        switch ((error as any).code) {
          case 404:
            errorMessage = 'Player not found. Check the Steam ID and make sure they have CS2 data on Leetify.';
            break;
          case 429:
            errorMessage = 'Rate limit hit. Try again in a few minutes.';
            break;
          case 401:
            errorMessage = 'API authentication issue. Contact the bot admin.';
            break;
        }
      }

      const errorEmbed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle('❌ Error')
        .setDescription(errorMessage);

      await interaction.editReply({ embeds: [errorEmbed] });
    }
  }
};

export default command;