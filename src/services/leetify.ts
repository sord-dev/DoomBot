import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { logger } from '../utils/logger';
import { normalizeToDecimal, formatAsPercentage, type ApiEndpoint } from '../utils/dataFormatter';

export interface LeetifyPlayerProfile {
  steamId: string;
  nickname: string;
  profileImageUrl?: string;
  skillLevel: number;
  gamesCount: number;
  winRate: number;
  averageRating: number;
  killDeathRatio: number;
  headshotPercentage: number;
  damagePerRound: number;
  averageKillsPerRound: number;
  averageDeathsPerRound: number;
  averageAssistsPerRound: number;
  clutchRate: number;
  firstKillRate: number;
  multiKillRate: number;
  utilityDamage: number;
  flashAssists: number;
  smokeSuccessRate: number;
  entryKillRate: number;
  tradeKillRate: number;
  survivalRate: number;
  roundsWithKill: number;
  roundsWithMultiKill: number;
  roundsWithClutch: number;
  lastUpdated: string;
}

export interface LeetifyMatchSummary {
  matchId: string;
  matchDate: string;
  mapName: string;
  gameMode: string;
  matchResult: 'win' | 'loss' | 'tie';
  playerScore: number;
  opponentScore: number;
  rating: number;
  kills: number;
  deaths: number;
  assists: number;
  adr: number; // Average Damage per Round
  headshots: number;
  headshotPercentage: number;
  firstKills: number;
  firstDeaths: number;
  clutchesWon: number;
  clutchesLost: number;
  utilityDamage: number;
  flashAssists: number;
  smokeSuccessRate: number;
  matchDurationMinutes: number;
}

export interface LeetifyMatchDetails extends LeetifyMatchSummary {
  teammates: Array<{
    steamId: string;
    nickname: string;
    kills: number;
    deaths: number;
    assists: number;
    rating: number;
  }>;
  opponents: Array<{
    steamId: string;
    nickname: string;
    kills: number;
    deaths: number;
    assists: number;
    rating: number;
  }>;
  rounds: Array<{
    roundNumber: number;
    winner: 'ct' | 't';
    reason: string;
    playerPerformance: {
      kills: number;
      deaths: number;
      damage: number;
      clutch: boolean;
      firstKill: boolean;
      firstDeath: boolean;
    };
  }>;
}

export interface LeetifyApiError {
  message: string;
  code: number;
  details?: any;
}

class LeetifyApiService {
  private api: AxiosInstance;
  private baseURL: string;
  private apiKey?: string;
  private lastRequestTime: number = 0;
  private minRequestInterval: number = 1000; // 1 second between requests

  constructor() {
    this.baseURL = process.env.LEETIFY_BASE_URL || 'https://api-public.cs-prod.leetify.com';
    this.apiKey = process.env.LEETIFY_API_KEY;
    
    this.api = axios.create({
      baseURL: this.baseURL,
      timeout: 30000, // 30 seconds
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'doombot/1.0.0',
        ...(this.apiKey && { 'Authorization': `Bearer ${this.apiKey}` })
      }
    });

    // Request interceptor for logging
    this.api.interceptors.request.use(
      (config) => {
        logger.debug(`Leetify API Request: ${config.method?.toUpperCase()} ${config.url}`, {
          params: config.params,
          hasAuth: !!config.headers.Authorization
        });
        return config;
      },
      (error) => {
        logger.error('Leetify API Request Error:', error);
        return Promise.reject(error);
      }
    );

    // Response interceptor for error handling
    this.api.interceptors.response.use(
      (response) => {
        logger.debug(`Leetify API Response: ${response.status} ${response.config.url}`, {
          dataSize: JSON.stringify(response.data).length
        });
        return response;
      },
      (error) => {
        const errorDetails = {
          status: error.response?.status,
          statusText: error.response?.statusText,
          url: error.config?.url,
          message: error.message
        };
        
        logger.error('Leetify API Response Error:', errorDetails);
        return Promise.reject(this.handleApiError(error));
      }
    );
  }

  private handleApiError(error: any): LeetifyApiError {
    if (error.response) {
      // Server responded with error status
      const status = error.response.status;
      const data = error.response.data;
      
      switch (status) {
        case 401:
          return {
            message: 'Invalid API key or unauthorized access',
            code: 401,
            details: data
          };
        case 403:
          return {
            message: 'Access forbidden - check API permissions',
            code: 403,
            details: data
          };
        case 404:
          return {
            message: 'Player or match not found',
            code: 404,
            details: data
          };
        case 429:
          return {
            message: 'Rate limit exceeded - please try again later',
            code: 429,
            details: data
          };
        case 500:
          return {
            message: 'Leetify server error - please try again later',
            code: 500,
            details: data
          };
        default:
          return {
            message: `API error: ${error.response.statusText}`,
            code: status,
            details: data
          };
      }
    } else if (error.request) {
      // Request timeout or network error
      return {
        message: 'Network error - unable to reach Leetify API',
        code: 0
      };
    } else {
      // Other error
      return {
        message: `Request error: ${error.message}`,
        code: -1
      };
    }
  }

  async getPlayerProfile(steamId: string): Promise<LeetifyPlayerProfile> {
    // Simple rate limiting
    await this.rateLimiter();

    try {
      // Get both profile and recent matches for comprehensive stats
      const [profileResponse, matchesResponse] = await Promise.all([
        this.api.get('/v3/profile', { params: { steam64_id: steamId } }),
        this.api.get('/v3/profile/matches', { params: { steam64_id: steamId } })
      ]);
      
      return this.transformPlayerProfile(profileResponse.data, matchesResponse.data || [], steamId);
    } catch (error) {
      logger.error(`Failed to fetch player profile for ${steamId}:`, error);
      throw error;
    }
  }

  async getPlayerMatches(steamId: string, limit: number = 10): Promise<LeetifyMatchSummary[]> {
    await this.rateLimiter();

    try {
      const response: AxiosResponse = await this.api.get('/v3/profile/matches', {
        params: { steam64_id: steamId }
      });
      
      const matches = (response.data || []).slice(0, limit).map((match: any) => 
        this.transformMatchSummary(match, steamId)
      );
      
      return matches;
    } catch (error) {
      logger.error(`Failed to fetch matches for ${steamId}:`, error);
      throw error;
    }
  }

  async getMatchDetails(matchId: string, steamId: string): Promise<LeetifyMatchDetails> {
    await this.rateLimiter();

    try {
      const response: AxiosResponse = await this.api.get(`/api/match/${matchId}`, {
        params: { steamId }
      });
      
      return this.transformMatchDetails(response.data, steamId);
    } catch (error) {
      logger.error(`Failed to fetch match details for ${matchId}:`, error);
      throw error;
    }
  }

  private async rateLimiter(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < this.minRequestInterval) {
      const delay = this.minRequestInterval - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    
    this.lastRequestTime = Date.now();
  }

  // Transform raw API responses to our interface format
  private transformPlayerProfile(profileData: any, matchesData: any[], steamId: string): LeetifyPlayerProfile {
    // Use last 30 matches for current performance analysis
    const recentMatches = matchesData.slice(0, 30);
    const matchCount = recentMatches.length;
    
    let totalKills = 0, totalDeaths = 0, totalAssists = 0, totalDamage = 0;
    let totalHeadshotKills = 0, totalRounds = 0, totalWins = 0;
    let totalFirstKills = 0, totalClutches = 0, totalMultiKills = 0;
    let totalRating = 0, totalSurvived = 0;
    
    // Find player stats in each match
    for (const match of recentMatches) {
      const playerStats = match.stats?.find((s: any) => s.steam64_id === steamId);
      if (playerStats) {
        totalKills += playerStats.total_kills || 0;
        totalDeaths += playerStats.total_deaths || 0;
        totalAssists += playerStats.total_assists || 0;
        totalDamage += playerStats.total_damage || 0;
        totalHeadshotKills += playerStats.total_hs_kills || 0;
        totalRounds += playerStats.rounds_count || 0;
        totalWins += playerStats.rounds_won || 0;
        totalRating += playerStats.leetify_rating || 0;
        totalSurvived += playerStats.rounds_survived || 0;
        
        // Count multi-kills (2k, 3k, 4k, 5k)
        totalMultiKills += (playerStats.multi2k || 0) + (playerStats.multi3k || 0) + 
                          (playerStats.multi4k || 0) + (playerStats.multi5k || 0);
      }
    }
    
    return {
      steamId,
      nickname: profileData.name || 'Unknown Player', 
      profileImageUrl: profileData.profileImageUrl,
      skillLevel: profileData.ranks?.leetify || 0,
      gamesCount: profileData.total_matches || 0,
      winRate: normalizeToDecimal(profileData.winrate || 0, 'winrate', 'profile'), // Keep as decimal internally
      averageRating: profileData.ranks?.leetify || 0, // This is the main Leetify rating
      killDeathRatio: matchCount > 0 && totalDeaths > 0 ? +(totalKills / totalDeaths).toFixed(2) : 0,
      headshotPercentage: matchCount > 0 && totalKills > 0 ? +((totalHeadshotKills / totalKills)).toFixed(3) : 0, // Keep as decimal
      damagePerRound: matchCount > 0 && totalRounds > 0 ? +(totalDamage / totalRounds).toFixed(1) : 0,
      averageKillsPerRound: matchCount > 0 && totalRounds > 0 ? +(totalKills / totalRounds).toFixed(2) : 0,
      averageDeathsPerRound: matchCount > 0 && totalRounds > 0 ? +(totalDeaths / totalRounds).toFixed(2) : 0,
      averageAssistsPerRound: matchCount > 0 && totalRounds > 0 ? +(totalAssists / totalRounds).toFixed(2) : 0,
      clutchRate: normalizeToDecimal(profileData.rating?.clutch || 0, 'clutch', 'profile'), // Keep as decimal
      firstKillRate: normalizeToDecimal(profileData.rating?.opening || 0, 'opening', 'profile'), // Keep as decimal
      multiKillRate: matchCount > 0 && totalRounds > 0 ? +((totalMultiKills / totalRounds)).toFixed(3) : 0, // Keep as decimal
      utilityDamage: profileData.stats?.he_foes_damage_avg || 0,
      flashAssists: profileData.stats?.flashbang_thrown || 0,
      smokeSuccessRate: 0,
      entryKillRate: normalizeToDecimal(profileData.rating?.opening || 0, 'opening', 'profile'), // Keep as decimal
      tradeKillRate: normalizeToDecimal(profileData.stats?.trade_kills_success_percentage || 0, 'trade_kills_success_percentage', 'profile'),
      survivalRate: matchCount > 0 && totalRounds > 0 ? +((totalSurvived / totalRounds)).toFixed(3) : 0, // Keep as decimal
      roundsWithKill: matchCount > 0 && totalRounds > 0 ? +((totalKills > 0 ? totalRounds - (totalRounds - totalKills) : 0) / totalRounds).toFixed(3) : 0, // Keep as decimal
      roundsWithMultiKill: matchCount > 0 && totalRounds > 0 ? +((totalMultiKills / totalRounds)).toFixed(3) : 0, // Keep as decimal
      roundsWithClutch: normalizeToDecimal(profileData.rating?.clutch || 0, 'clutch', 'profile'), // Keep as decimal
      lastUpdated: profileData.last_updated || new Date().toISOString()
    };
  }

  private transformMatchSummary(data: any, steamId: string): LeetifyMatchSummary {
    // Find the player's stats in the stats array
    const playerStats = data.stats?.find((stat: any) => stat.steam64_id === steamId);
    
    if (!playerStats) {
      logger.warn('Player stats not found in match data', { steamId, matchId: data.id });
    }
    
    // Determine match result based on team scores and player's initial team
    let matchResult: 'win' | 'loss' | 'tie' = 'loss';
    let playerScore = 0;
    let opponentScore = 0;
    
    if (data.team_scores && playerStats?.initial_team_number) {
      const playerTeam = data.team_scores.find((team: any) => team.team_number === playerStats.initial_team_number);
      const opponentTeam = data.team_scores.find((team: any) => team.team_number !== playerStats.initial_team_number);
      
      if (playerTeam && opponentTeam) {
        playerScore = playerTeam.score || 0;
        opponentScore = opponentTeam.score || 0;
        
        if (playerScore > opponentScore) {
          matchResult = 'win';
        } else if (playerScore === opponentScore) {
          matchResult = 'tie';
        } else {
          matchResult = 'loss';
        }
      }
    }

    return {
      matchId: data.id || 'unknown',
      matchDate: data.finished_at || new Date().toISOString(),
      mapName: data.map_name || 'Unknown',
      gameMode: data.data_source || 'competitive',
      matchResult: matchResult,
      playerScore: playerScore,
      opponentScore: opponentScore,
      rating: playerStats?.leetify_rating || 0,
      kills: playerStats?.total_kills || 0,
      deaths: playerStats?.total_deaths || 0,
      assists: playerStats?.total_assists || 0,
      adr: playerStats?.dpr || 0, // damage per round
      headshots: playerStats?.total_hs_kills || 0,
      headshotPercentage: playerStats?.total_kills > 0 ? (playerStats?.total_hs_kills || 0) / playerStats.total_kills : 0, // Keep as decimal
      firstKills: playerStats?.multi1k || 0,
      firstDeaths: 0, // Not available in this API structure
      clutchesWon: playerStats?.rounds_survived || 0,
      clutchesLost: 0, // Not directly available
      utilityDamage: playerStats?.utility_on_death_avg || 0,
      flashAssists: playerStats?.flash_assist || 0,
      smokeSuccessRate: 0, // Not directly available
      matchDurationMinutes: playerStats?.rounds_count || 0
    };
  }

  private transformMatchDetails(data: any, steamId: string): LeetifyMatchDetails {
    const summary = this.transformMatchSummary(data, steamId);
    
    return {
      ...summary,
      teammates: data.teammates?.map((player: any) => ({
        steamId: player.steamId,
        nickname: player.nickname || 'Unknown',
        kills: player.kills || 0,
        deaths: player.deaths || 0,
        assists: player.assists || 0,
        rating: player.rating || 0
      })) || [],
      opponents: data.opponents?.map((player: any) => ({
        steamId: player.steamId,
        nickname: player.nickname || 'Unknown',
        kills: player.kills || 0,
        deaths: player.deaths || 0,
        assists: player.assists || 0,
        rating: player.rating || 0
      })) || [],
      rounds: data.rounds?.map((round: any, index: number) => ({
        roundNumber: index + 1,
        winner: round.winner || 'ct',
        reason: round.reason || 'unknown',
        playerPerformance: {
          kills: round.playerStats?.kills || 0,
          deaths: round.playerStats?.deaths || 0,
          damage: round.playerStats?.damage || 0,
          clutch: round.playerStats?.clutch || false,
          firstKill: round.playerStats?.firstKill || false,
          firstDeath: round.playerStats?.firstDeath || false
        }
      })) || []
    };
  }


  // Returns raw profile data without transformation
  // used by /improve to access rating + stats sub-metrics directly
  async getRawProfile(steamId: string): Promise<any> {
    await this.rateLimiter();
    try {
      const response: AxiosResponse = await this.api.get("/v3/profile", {
        params: { steam64_id: steamId }
      });
      return response.data;
    } catch (error) {
      logger.error(`Failed to fetch raw profile for ${steamId}:`, error);
      throw error;
    }
  }

  // Health check method
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.api.get('/api/health', { timeout: 5000 });
      return response.status === 200;
    } catch (error) {
      logger.warn('Leetify API health check failed:', error);
      return false;
    }
  }
}

export const leetifyApi = new LeetifyApiService();
export default leetifyApi;