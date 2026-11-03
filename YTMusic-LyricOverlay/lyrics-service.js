/**
 * lyrics-service.js
 * High-reliability lyrics engine for English, Hindi, Bollywood, Punjabi, and international songs.
 * Supports exact LRC timestamps AND smart-paced timing for plain lyrics so lyrics ALWAYS move with playback.
 */

class LyricsService {
  constructor() {
    this.cache = new Map();
  }

  /**
   * Cleans messy video titles (especially Bollywood, T-Series, Zee Music, Indian tracks)
   */
  cleanTitle(rawTitle) {
    if (!rawTitle) return '';
    let t = rawTitle;

    // 1. If pipe separator exists, first part is the song title
    if (t.includes('|')) {
      t = t.split('|')[0];
    }

    // 2. If ' - ' exists (e.g. Song - Movie Name), extract first part
    if (t.includes(' - ')) {
      t = t.split(' - ')[0];
    }

    // 3. Remove bracketed / parenthetical noise
    t = t.replace(/\s*[\(\[](?:from\s*["'].*?["']|hindi|punjabi|tamil|telugu|bhojpuri|version|original|soundtrack|ost|official\s*(?:music\s*)?(?:video|audio|lyric|lyrics\s*video|visualizer)|lyrical\s*(?:video)?|full\s*(?:video|song)|audio\s*song|video\s*song|hook\s*step|lyrics?|audio|hd|4k|remaster(?:ed)?|live)[\)\]]/gi, '');
    
    // 4. Remove features
    t = t.replace(/\s*[\(\[]\s*(?:feat|ft)\.?\s+[^)\]]+[\)\]]/gi, '');

    // 5. Remove trailing fluff
    t = t.replace(/\s*-\s*(?:remastered|live|radio edit|bonus track).*$/gi, '');
    
    // 6. Clean quotes and whitespace
    t = t.replace(/["'“”]/g, '').trim();

    return t;
  }

  /**
   * Cleans artist name
   */
  cleanArtist(rawArtist) {
    if (!rawArtist) return '';
    let a = rawArtist;

    if (a.includes('•')) {
      a = a.split('•')[0];
    }
    if (a.includes(',')) {
      a = a.split(',')[0];
    }
    if (a.includes('&')) {
      a = a.split('&')[0];
    }

    return a.trim();
  }

  /**
   * Parses standard LRC string into [{ time, text }]
   */
  parseLRC(lrcText) {
    if (!lrcText) return [];
    const lines = lrcText.split('\n');
    const result = [];
    const timeRegex = /\[(\d{2}):(\d{2})(?:\.(\d{2,3}))?\]/g;

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;

      const matches = [...line.matchAll(timeRegex)];
      if (matches.length === 0) continue;

      const text = line.replace(timeRegex, '').trim();

      for (const match of matches) {
        const min = parseInt(match[1], 10);
        const sec = parseInt(match[2], 10);
        const frac = match[3] ? parseFloat('0.' + match[3]) : 0;
        const totalTime = min * 60 + sec + frac;

        result.push({
          time: Math.round(totalTime * 100) / 100,
          text: text
        });
      }
    }

    result.sort((a, b) => a.time - b.time);
    return result;
  }

  /**
   * Converts plain text lyrics into paced timestamps across the song duration.
   * Guarantees that EVEN PLAIN LYRICS (like Hindi songs or YT Music tab)
   * WILL AUTO-SCROLL AND MOVE ALONG WITH PLAYBACK!
   */
  generatePacedLines(plainText, songDuration) {
    if (!plainText) return [];
    
    const lines = plainText
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0);

    if (lines.length === 0) return [];

    const duration = (songDuration && songDuration > 30) ? songDuration : 210;
    
    const intro = Math.min(16, duration * 0.08);
    const outro = Math.min(14, duration * 0.07);
    const singingDuration = Math.max(10, duration - intro - outro);
    const step = singingDuration / lines.length;

    return lines.map((text, i) => {
      const time = Math.round((intro + (i * step)) * 100) / 100;
      return {
        time,
        text
      };
    });
  }

  /**
   * Main method to get lyrics with multi-source fallback
   */
  async getLyrics(rawTitle, rawArtist, durationSeconds = null) {
    const title = this.cleanTitle(rawTitle);
    const artist = this.cleanArtist(rawArtist);
    const cacheKey = `${title.toLowerCase()}|||${artist.toLowerCase()}`;

    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    let result = null;

    // 1. Check YouTube Music native lyrics tab directly in DOM
    const ytLyrics = this.scrapeYTMusicLyrics();
    if (ytLyrics) {
      console.log('[YTMusicLyrics] Found lyrics in YouTube Music tab');
      result = {
        trackName: title || rawTitle,
        artistName: artist || rawArtist,
        isSynced: false,
        isPaced: true,
        syncedLines: this.generatePacedLines(ytLyrics, durationSeconds),
        plainLyrics: ytLyrics,
        source: 'YouTube Music'
      };
    }

    // 2. Try LRCLIB for exact timestamped synchronized lyrics
    if (!result || !result.isSynced) {
      try {
        const lrclibData = await this.fetchWithTimeout(
          `https://lrclib.net/api/get?track_name=${encodeURIComponent(title)}&artist_name=${encodeURIComponent(artist)}`,
          2500
        );

        if (lrclibData && lrclibData.syncedLyrics) {
          result = {
            id: lrclibData.id,
            trackName: lrclibData.trackName || title,
            artistName: lrclibData.artistName || artist,
            isSynced: true,
            isPaced: false,
            syncedLines: this.parseLRC(lrclibData.syncedLyrics),
            plainLyrics: lrclibData.plainLyrics || '',
            source: 'LRCLIB (Synced)'
          };
        } else if (lrclibData && lrclibData.plainLyrics && !result) {
          result = {
            id: lrclibData.id,
            trackName: lrclibData.trackName || title,
            artistName: lrclibData.artistName || artist,
            isSynced: false,
            isPaced: true,
            syncedLines: this.generatePacedLines(lrclibData.plainLyrics, durationSeconds),
            plainLyrics: lrclibData.plainLyrics,
            source: 'LRCLIB'
          };
        }
      } catch (err) {
        console.warn('[YTMusicLyrics] LRCLIB get error:', err.message);
      }
    }

    // 3. Try LRCLIB search fallback
    if (!result || !result.isSynced) {
      try {
        const query = `${title} ${artist}`.trim();
        const searchList = await this.fetchWithTimeout(
          `https://lrclib.net/api/search?q=${encodeURIComponent(query)}`,
          2500
        );

        if (Array.isArray(searchList) && searchList.length > 0) {
          const syncedItem = searchList.find(item => item.syncedLyrics);
          if (syncedItem && syncedItem.syncedLyrics) {
            result = {
              id: syncedItem.id,
              trackName: syncedItem.trackName || title,
              artistName: syncedItem.artistName || artist,
              isSynced: true,
              isPaced: false,
              syncedLines: this.parseLRC(syncedItem.syncedLyrics),
              plainLyrics: syncedItem.plainLyrics || '',
              source: 'LRCLIB (Search Synced)'
            };
          } else if (!result && searchList[0].plainLyrics) {
            result = {
              id: searchList[0].id,
              trackName: searchList[0].trackName || title,
              artistName: searchList[0].artistName || artist,
              isSynced: false,
              isPaced: true,
              syncedLines: this.generatePacedLines(searchList[0].plainLyrics, durationSeconds),
              plainLyrics: searchList[0].plainLyrics,
              source: 'LRCLIB'
            };
          }
        }
      } catch (err) {
        console.warn('[YTMusicLyrics] LRCLIB search error:', err.message);
      }
    }

    // 4. Fallback to Lyrics.ovh for plain lyrics
    if (!result) {
      try {
        const ovhData = await this.fetchWithTimeout(
          `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`,
          2500
        );
        if (ovhData && ovhData.lyrics) {
          result = {
            trackName: title,
            artistName: artist,
            isSynced: false,
            isPaced: true,
            syncedLines: this.generatePacedLines(ovhData.lyrics, durationSeconds),
            plainLyrics: ovhData.lyrics,
            source: 'Lyrics.ovh'
          };
        }
      } catch {
        // ignore
      }
    }

    // 5. Final attempt: Re-check YouTube Music tab
    if (!result) {
      const lateLyrics = this.scrapeYTMusicLyrics();
      if (lateLyrics) {
        result = {
          trackName: title || rawTitle,
          artistName: artist || rawArtist,
          isSynced: false,
          isPaced: true,
          syncedLines: this.generatePacedLines(lateLyrics, durationSeconds),
          plainLyrics: lateLyrics,
          source: 'YouTube Music'
        };
      }
    }

    if (result) {
      this.cache.set(cacheKey, result);
    }

    return result;
  }

  async fetchWithTimeout(url, timeoutMs = 2500) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
      });
      clearTimeout(timeoutId);
      if (!res.ok) return null;
      return await res.json();
    } catch {
      clearTimeout(timeoutId);
      return null;
    }
  }

  /**
   * Scrapes lyrics from YouTube Music tab if rendered
   */
  scrapeYTMusicLyrics() {
    try {
      const selectors = [
        'ytmusic-tab-renderer[tab-id="FEmusic_lyrics"] .non-expandable',
        'ytmusic-tab-renderer[page-type="MUSIC_PAGE_TYPE_TRACK_LYRICS"] .non-expandable',
        'ytmusic-description-shelf-renderer .description',
        'yt-formatted-string.description',
        '#lyrics.ytmusic-player-page',
        'ytmusic-player-page ytmusic-tab-renderer[selected] .non-expandable',
        '.description.ytmusic-description-shelf-renderer'
      ];

      for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el && el.innerText && el.innerText.trim().length > 20) {
          return el.innerText.trim();
        }
      }
    } catch {
      // ignore
    }
    return null;
  }
}

window.__LyricsService = LyricsService;
