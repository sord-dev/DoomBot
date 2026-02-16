/**
 * Utility functions for Steam ID validation and conversion
 */

export interface SteamIDInfo {
  steam64: string;
  steam32: string;
  steamID: string;
  profileUrl: string;
  isValid: boolean;
}

/**
 * Convert Steam32 ID to Steam64
 */
export function steam32ToSteam64(steam32: string): string {
  const accountId = parseInt(steam32);
  if (isNaN(accountId)) throw new Error('Invalid Steam32 ID');
  
  // Steam64 = 76561197960265728 + Steam32
  const steam64 = (BigInt('76561197960265728') + BigInt(accountId)).toString();
  return steam64;
}

/**
 * Convert Steam64 ID to Steam32
 */
export function steam64ToSteam32(steam64: string): string {
  const steam64BigInt = BigInt(steam64);
  const steam32 = steam64BigInt - BigInt('76561197960265728');
  return steam32.toString();
}

/**
 * Convert Steam32 to legacy SteamID format (STEAM_0:Y:Z)
 */
export function steam32ToSteamID(steam32: string): string {
  const accountId = parseInt(steam32);
  if (isNaN(accountId)) throw new Error('Invalid Steam32 ID');
  
  const y = accountId % 2;
  const z = Math.floor(accountId / 2);
  return `STEAM_0:${y}:${z}`;
}

/**
 * Convert legacy SteamID format to Steam32
 */
export function steamIDToSteam32(steamID: string): string {
  const match = steamID.match(/^STEAM_0:([01]):(\d+)$/);
  if (!match) throw new Error('Invalid SteamID format');
  
  const y = parseInt(match[1]);
  const z = parseInt(match[2]);
  const steam32 = z * 2 + y;
  return steam32.toString();
}

/**
 * Extract Steam64 ID from various Steam profile URL formats
 */
export function extractSteamIdFromUrl(url: string): string | null {
  // Steam64 ID from profile URL: https://steamcommunity.com/profiles/76561198XXXXXXXXX
  const steam64Match = url.match(/steamcommunity\.com\/profiles\/(\d{17})/);
  if (steam64Match) {
    return steam64Match[1];
  }
  
  // Custom URL format: https://steamcommunity.com/id/customname
  // This would need Steam Web API to resolve, return null for now
  const customMatch = url.match(/steamcommunity\.com\/id\/([^/]+)/);
  if (customMatch) {
    return null; // Requires Steam Web API resolution
  }
  
  return null;
}

/**
 * Validate and normalize Steam ID input
 */
export function validateAndNormalizeSteamId(input: string): SteamIDInfo {
  const trimmedInput = input.trim();
  
  try {
    // Check if it's a Steam profile URL
    const urlExtracted = extractSteamIdFromUrl(trimmedInput);
    if (urlExtracted) {
      return normalizeSteam64(urlExtracted);
    }
    
    // Check if it's a Steam64 ID (17 digits)
    if (/^\d{17}$/.test(trimmedInput)) {
      return normalizeSteam64(trimmedInput);
    }
    
    // Check if it's a Steam32 ID (shorter number)
    if (/^\d{1,10}$/.test(trimmedInput)) {
      const steam64 = steam32ToSteam64(trimmedInput);
      return normalizeSteam64(steam64);
    }
    
    // Check if it's legacy SteamID format
    if (/^STEAM_0:[01]:\d+$/.test(trimmedInput)) {
      const steam32 = steamIDToSteam32(trimmedInput);
      const steam64 = steam32ToSteam64(steam32);
      return normalizeSteam64(steam64);
    }
    
    // Invalid format
    return {
      steam64: '',
      steam32: '',
      steamID: '',
      profileUrl: '',
      isValid: false
    };
    
  } catch (error) {
    return {
      steam64: '',
      steam32: '',
      steamID: '',
      profileUrl: '',
      isValid: false
    };
  }
}

/**
 * Helper function to create SteamIDInfo from Steam64
 */
function normalizeSteam64(steam64: string): SteamIDInfo {
  try {
    const steam32 = steam64ToSteam32(steam64);
    const steamID = steam32ToSteamID(steam32);
    const profileUrl = `https://steamcommunity.com/profiles/${steam64}`;
    
    return {
      steam64,
      steam32,
      steamID,
      profileUrl,
      isValid: true
    };
  } catch (error) {
    return {
      steam64: '',
      steam32: '',
      steamID: '',
      profileUrl: '',
      isValid: false
    };
  }
}

/**
 * Check if a Steam64 ID appears to be valid (basic validation)
 */
export function isValidSteam64(steam64: string): boolean {
  // Must be 17 digits and within reasonable range
  if (!/^\d{17}$/.test(steam64)) return false;
  
  const steam64BigInt = BigInt(steam64);
  const minSteam64 = BigInt('76561197960265728'); // Lowest possible Steam64
  const maxSteam64 = BigInt('76561202255233023'); // Reasonable upper bound
  
  return steam64BigInt >= minSteam64 && steam64BigInt <= maxSteam64;
}

/**
 * Generate various Steam ID formats for display
 */
export function formatSteamIds(steam64: string): string {
  try {
    const info = normalizeSteam64(steam64);
    if (!info.isValid) return 'Invalid Steam ID';
    
    return `**Steam64:** ${info.steam64}\n**Steam32:** ${info.steam32}\n**SteamID:** ${info.steamID}`;
  } catch (error) {
    return 'Invalid Steam ID';
  }
}