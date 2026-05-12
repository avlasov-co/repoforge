/**
 * Audio Player Modifications Module
 * 
 * Handles modifications to Spotify's audio player to ensure smooth playback
 * while blocking ads and maintaining audio quality.
 */

import { safeInjectScript } from '../utils/safe-injector.js';
import type { AdBlockConfig } from '../types/index.js';

export interface AudioPlayerMod {
  name: string;
  description: string;
  enabled: boolean;
  apply(): Promise<void>;
}

const AUDIO_PLAYER_MODS: AudioPlayerMod[] = [
  {
    name: 'smooth-playback',
    description: 'Ensures smooth audio playback without interruptions from ad events',
    enabled: true,
    async apply() {
      const script = `
        // Smooth Playback Protection
        (function() {
          let isAdPlaying = false;
          let originalPlay = HTMLAudioElement.prototype.play.bind(HTMLAudioElement);
          let originalPause = HTMLAudioElement.prototype.pause.bind(HTMLAudioElement);

          HTMLAudioElement.prototype.play = function() {
            if (!isAdPlaying) {
              return originalPlay.call(this);
            }
            // Resume main audio when ad ends
            setTimeout(() => {
              if (this.paused && !isAdPlaying) {
                this.play();
              }
            }, 1000);
            return false;
          };

          HTMLAudioElement.prototype.pause = function() {
            isAdPlaying = true;
            return originalPause.call(this);
          };
        })();
      `;
      safeInjectScript(script);
    }
  },

  {
    name: 'volume-protect',
    description: 'Prevents volume changes during ad playback',
    enabled: true,
    async apply() {
      const script = `
        // Volume Protection
        (function() {
          let originalVolume = null;

          function protectVolume() {
            if (!originalVolume) {
              originalVolume = document.body.dataset.volume || '1';
            }

            // Restore volume after ad
            setTimeout(() => {
              const audio = document.querySelector('audio');
              if (audio && originalVolume) {
                audio.volume = parseFloat(originalVolume);
              }
            }, 2000);
          }

          // Monitor for volume changes
          let observer;
          try {
            observer = new MutationObserver(() => {
              protectVolume();
            });
            observer.observe(document.body, { attributes: true, attributeFilter: ['data-volume'] });
          } catch (e) {}
        })();
      `;
      safeInjectScript(script);
    }
  },

  {
    name: 'skip-ad-override',
    description: 'Overrides ad skip functionality to prevent forced ads',
    enabled: true,
    async apply() {
      const script = `
        // Ad Skip Override
        (function() {
          function handleSkipClick(event) {
            const target = event.target.closest('[data-testid="skip-ad"], .ad-skip-btn');
            if (!target) return;

            // Prevent forced ad playback
            event.preventDefault();
            event.stopPropagation();

            // Show user-friendly message instead
            const skipBtn = document.createElement('button');
            skipBtn.textContent = 'Skip Ad (Premium Only)';
            skipBtn.style.cssText = `
              position: fixed;
              top: 50%;
              left: 50%;
              transform: translate(-50%, -50%);
              padding: 16px 32px;
              background: #1db954;
              color: white;
              border: none;
              border-radius: 8px;
              font-size: 16px;
              cursor: pointer;
            `;

            skipBtn.onclick = () => {
              document.body.removeChild(skipBtn);
            };

            document.body.appendChild(skipBtn);
          }

          // Monitor for ad skip buttons
          let observer;
          try {
            observer = new MutationObserver(() => {
              const skipBtns = document.querySelectorAll('[data-testid="skip-ad"], .ad-skip-btn');
              skipBtns.forEach(btn => btn.remove());
            });
            observer.observe(document.body, { childList: true, subtree: true });
          } catch (e) {}
        })();
      `;
      safeInjectScript(script);
    }
  },

  {
    name: 'audio-quality-protect',
    description: 'Maintains audio quality settings during ad playback',
    enabled: true,
    async apply() {
      const script = `
        // Audio Quality Protection
        (function() {
          let originalQuality = null;

          function saveAndRestoreQuality() {
            if (!originalQuality) {
              // Save current quality settings
              try {
                const audioEl = document.querySelector('audio');
                if (audioEl) {
                  originalQuality = {
                    autoplay: audioEl.autoplay,
                    muted: audioEl.muted,
                    volume: audioEl.volume
                  };
                }
              } catch (e) {}
            }

            // Restore after ad
            setTimeout(() => {
              try {
                const audio = document.querySelector('audio');
                if (audio && originalQuality) {
                  audio.autoplay = originalQuality.autoplay || false;
                  audio.muted = originalQuality.muted || false;
                  audio.volume = originalQuality.volume || 1;
                }
              } catch (e) {}
            }, 3000);
          }

          // Monitor for ad events
          let observer;
          try {
            observer = new MutationObserver(() => {
              saveAndRestoreQuality();
            });
            observer.observe(document.body, { childList: true, subtree: true });
          } catch (e) {}
        })();
      `;
      safeInjectScript(script);
    }
  },

  {
    name: 'buffer-protection',
    description: 'Prevents buffering issues during ad transitions',
    enabled: true,
    async apply() {
      const script = `
        // Buffer Protection
        (function() {
          let isBuffering = false;

          function handleBuffer(event) {
            if (!isBuffering && event.type === 'waiting') {
              isBuffering = true;
              
              // Preload next track to prevent buffering during ads
              try {
                const currentTrack = document.querySelector('[data-testid="current-track"]');
                if (currentTrack) {
                  const nextTrackUrl = currentTrack.dataset.next || '';
                  if (nextTrackUrl) {
                    const audio = new Audio(nextTrackUrl);
                    audio.preload = 'metadata';
                  }
                }
              } catch (e) {}
            }
          }

          // Monitor for buffering events
          let observer;
          try {
            observer = new MutationObserver(() => {
              handleBuffer({ type: 'waiting' });
            });
            observer.observe(document.body, { childList: true, subtree: true });
          } catch (e) {}
        })();
      `;
      safeInjectScript(script);
    }
  },

  {
    name: 'seek-protection',
    description: 'Prevents unwanted seeking during ad playback',
    enabled: true,
    async apply() {
      const script = `
        // Seek Protection
        (function() {
          let isAdPlaying = false;

          function handleSeek(event) {
            if (!isAdPlaying && event.type === 'seeking') {
              // Allow normal seeking
              return true;
            }

            // During ad, prevent unwanted seeks
            const target = event.target.closest('[data-testid="skip-ad"], .ad-skip-btn');
            if (target) {
              event.preventDefault();
              return false;
            }

            return true;
          }

          // Monitor for seek events
          let observer;
          try {
            observer = new MutationObserver(() => {
              handleSeek({ type: 'seeking' });
            });
            observer.observe(document.body, { childList: true, subtree: true });
          } catch (e) {}
        })();
      `;
      safeInjectScript(script);
    }
  },

  {
    name: 'track-info-protect',
    description: 'Preserves track information during ad playback',
    enabled: true,
    async apply() {
      const script = `
        // Track Info Protection
        (function() {
          let currentTrackInfo = null;

          function saveTrackInfo() {
            try {
              const trackEl = document.querySelector('[data-testid="current-track"]');
              if (trackEl) {
                currentTrackInfo = {
                  title: trackEl.dataset.title || '',
                  artist: trackEl.dataset.artist || '',
                  album: trackEl.dataset.album || ''
                };
              }
            } catch (e) {}
          }

          // Monitor for track changes
          let observer;
          try {
            observer = new MutationObserver(() => {
              saveTrackInfo();
            });
            observer.observe(document.body, { childList: true, subtree: true });
          } catch (e) {}
        })();
      `;
      safeInjectScript(script);
    }
  },

  {
    name: 'shuffle-protection',
    description: 'Maintains shuffle state during ad playback',
    enabled: true,
    async apply() {
      const script = `
        // Shuffle Protection
        (function() {
          let isShuffling = false;

          function handleShuffle(event) {
            if (!isShuffling && event.type === 'shuffle') {
              return true;
            }

            // During ad, preserve shuffle state
            const target = event.target.closest('[data-testid="skip-ad"], .ad-skip-btn');
            if (target) {
              event.preventDefault();
              return false;
            }

            return true;
          }

          // Monitor for shuffle events
          let observer;
          try {
            observer = new MutationObserver(() => {
              handleShuffle({ type: 'shuffle' });
            });
            observer.observe(document.body, { childList: true, subtree: true });
          } catch (e) {}
        })();
      `;
      safeInjectScript(script);
    }
  },

  {
    name: 'repeat-protection',
    description: 'Maintains repeat state during ad playback',
    enabled: true,
    async apply() {
      const script = `
        // Repeat Protection
        (function() {
          let isRepeating = false;

          function handleRepeat(event) {
            if (!isRepeating && event.type === 'repeat') {
              return true;
            }

            // During ad, preserve repeat state
            const target = event.target.closest('[data-testid="skip-ad"], .ad-skip-btn');
            if (target) {
              event.preventDefault();
              return false;
            }

            return true;
          }

          // Monitor for repeat events
          let observer;
          try {
            observer = new MutationObserver(() => {
              handleRepeat({ type: 'repeat' });
            });
            observer.observe(document.body, { childList: true, subtree: true });
          } catch (e) {}
        })();
      `;
      safeInjectScript(script);
    }
  },

  {
    name: 'playback-rate-protect',
    description: 'Maintains playback rate during ad playback',
    enabled: true,
    async apply() {
      const script = `
        // Playback Rate Protection
        (function() {
          let originalRate = null;

          function saveAndRestoreRate() {
            if (!originalRate) {
              try {
                const audio = document.querySelector('audio');
                if (audio) {
                  originalRate = audio.playbackRate;
                }
              } catch (e) {}
            }

            // Restore after ad
            setTimeout(() => {
              try {
                const audio = document.querySelector('audio');
                if (audio && originalRate !== null) {
                  audio.playbackRate = originalRate;
                }
              } catch (e) {}
            }, 3000);
          }

          // Monitor for ad events
          let observer;
          try {
            observer = new MutationObserver(() => {
              saveAndRestoreRate();
            });
            observer.observe(document.body, { childList: true, subtree: true });
          } catch (e) {}
        })();
      `;
      safeInjectScript(script);
    }
  },

  {
    name: 'equalizer-protect',
    description: 'Preserves equalizer settings during ad playback',
    enabled: true,
    async apply() {
      const script = `
        // Equalizer Protection
        (function() {
          let originalEQ = null;

          function saveAndRestoreEQ() {
            if (!originalEQ) {
              try {
                const eqEl = document.querySelector('[data-testid="equalizer"]');
                if (eqEl) {
                  originalEQ = Array.from(eqEl.querySelectorAll('input[type="range"]'))
                    .map(input => ({
                      id: input.id,
                      value: input.value
                    }));
                }
              } catch (e) {}
            }

            // Restore after ad
            setTimeout(() => {
              try {
                const eqEl = document.querySelector('[data-testid="equalizer"]');
                if (eqEl && originalEQ) {
                  originalEQ.forEach(({ id, value }) => {
                    const input = eqEl.querySelector(`#${id}`);
                    if (input) input.value = value;
                  });
                }
              } catch (e) {}
            }, 3000);
          }

          // Monitor for ad events
          let observer;
          try {
            observer = new MutationObserver(() => {
              saveAndRestoreEQ();
            });
            observer.observe(document.body, { childList: true, subtree: true });
          } catch (e) {}
        })();
      `;
      safeInjectScript(script);
    }
  },

  {
    name: 'crossfade-protect',
    description: 'Maintains crossfade settings during ad playback',
    enabled: true,
    async apply() {
      const script = `
        // Crossfade Protection
        (function() {
          let originalCrossfade = null;

          function saveAndRestoreCrossfade() {
            if (!originalCrossfade) {
              try {
                const crossfadeEl = document.querySelector('[data-testid="crossfade"]');
                if (crossfadeEl) {
                  originalCrossfade = crossfadeEl.dataset.value || '0';
                }
              } catch (e) {}
            }

            // Restore after ad
            setTimeout(() => {
              try {
                const crossfadeEl = document.querySelector('[data-testid="crossfade"]');
                if (crossfadeEl && originalCrossfade !== null) {
                  crossfadeEl.dataset.value = originalCrossfade;
                }
              } catch (e) {}
            }, 3000);
          }

          // Monitor for ad events
          let observer;
          try {
            observer = new MutationObserver(() => {
              saveAndRestoreCrossfade();
            });
            observer.observe(document.body, { childList: true, subtree: true });
          } catch (e) {}
        })();
      `;
      safeInjectScript(script);
    }
  },

  {
    name: 'gapless-protect',
    description: 'Maintains gapless playback during ad transitions',
    enabled: true,
    async apply() {
      const script = `
        // Gapless Playback Protection
        (function() {
          let isGaplessEnabled = false;

          function handleTrackChange(event) {
            if (!isGaplessEnabled && event.type === 'trackchange') {
              return true;
            }

            // During ad, preserve gapless settings
            const target = event.target.closest('[data-testid="skip-ad"], .ad-skip-btn');
            if (target) {
              event.preventDefault();
              return false;
            }

            return true;
          }

          // Monitor for track changes
          let observer;
          try {
            observer = new MutationObserver(() => {
              handleTrackChange({ type: 'trackchange' });
            });
            observer.observe(document.body, { childList: true, subtree: true });
          } catch (e) {}
        })();
      `;
      safeInjectScript(script);
    }
  },

  {
    name: 'lyrics-protect',
    description: 'Preserves lyrics display during ad playback',
    enabled: true,
    async apply() {
      const script = `
        // Lyrics Protection
        (function() {
          let isLyricsVisible = false;

          function handleLyrics(event) {
            if (!isLyricsVisible && event.type === 'lyrics') {
              return true;
            }

            // During ad, preserve lyrics state
            const target = event.target.closest('[data-testid="skip-ad"], .ad-skip-btn');
            if (target) {
              event.preventDefault();
              return false;
            }

            return true;
          }

          // Monitor for lyrics events
          let observer;
          try {
            observer = new MutationObserver(() => {
              handleLyrics({ type: 'lyrics' });
            });
            observer.observe(document.body, { childList: true, subtree: true });
          } catch (e) {}
        })();
      `;
      safeInjectScript(script);
    }
  },

  {
    name: 'search-protect',
    description: 'Preserves search state during ad playback',
    enabled: true,
    async apply() {
      const script = `
        // Search Protection
        (function() {
          let isSearching = false;

          function handleSearch(event) {
            if (!isSearching && event.type === 'search') {
              return true;
            }

            // During ad, preserve search state
            const target = event.target.closest('[data-testid="skip-ad"], .ad-skip-btn');
            if (target) {
              event.preventDefault();
              return false;
            }

            return true;
          }

          // Monitor for search events
          let observer;
          try {
            observer = new MutationObserver(() => {
              handleSearch({ type: 'search' });
            });
            observer.observe(document.body, { childList: true, subtree: true });
          } catch (e) {}
        })();
      `;
      safeInjectScript(script);
    }
  },

  {
    name: 'library-protect',
    description: 'Preserves library state during ad playback',
    enabled: true,
    async apply() {
      const script = `
        // Library Protection
        (function() {
          let isLibraryOpen = false;

          function handleLibrary(event) {
            if (!isLibraryOpen && event.type === 'library') {
              return true;
            }

            // During ad, preserve library state
            const target = event.target.closest('[data-testid="skip-ad"], .ad-skip-btn');
            if (target) {
              event.preventDefault();
              return false;
            }

            return true;
          }

          // Monitor for library events
          let observer;
          try {
            observer = new MutationObserver(() => {
              handleLibrary({ type: 'library' });
            });
            observer.observe(document.body, { childList: true, subtree: true });
          } catch (e) {}
        })();
      `;
      safeInjectScript(script);
    }
  },

  {
    name: 'queue-protect',
    description: 'Preserves queue state during ad playback',
    enabled: true,
    async apply() {
      const script = `
        // Queue Protection
        (function() {
          let isQueueOpen = false;

          function handleQueue(event) {
            if (!isQueueOpen && event.type === 'queue') {
              return true;
            }

            // During ad, preserve queue state
            const target = event.target.closest('[data-testid="skip-ad"], .ad-skip-btn');
            if (target) {
              event.preventDefault();
              return false;
            }

            return true;
          }

          // Monitor for queue events
          let observer;
          try {
            observer = new MutationObserver(() => {
              handleQueue({ type: 'queue' });
            });
            observer.observe(document.body, { childList: true, subtree: true });
          } catch (e) {}
        })();
      `;
      safeInjectScript(script);
    }
  },

  {
    name: 'playlist-protect',
    description: 'Preserves playlist state during ad playback',
    enabled: true,
    async apply() {
      const script = `
        // Playlist Protection
        (function() {
          let isPlaylistOpen = false;

          function handlePlaylist(event) {
            if (!isPlaylistOpen && event.type === 'playlist') {
              return true;
            }

            // During ad, preserve playlist state
            const target = event.target.closest('[data-testid="skip-ad"], .ad-skip-btn');
            if (target) {
              event.preventDefault();
              return false;
            }

            return true;
          }

          // Monitor for playlist events
          let observer;
          try {
            observer = new MutationObserver(() => {
              handlePlaylist({ type: 'playlist' });
            });
            observer.observe(document.body, { childList: true, subtree: true });
          } catch (e) {}
        })();
      `;
      safeInjectScript(script);
    }
  },

  {
    name: 'album-protect',
    description: 'Preserves album view state during ad playback',
    enabled: true,
    async apply() {
      const script = `
        // Album Protection
        (function() {
          let isAlbumOpen = false;

          function handleAlbum(event) {
            if (!isAlbumOpen && event.type === 'album') {
              return true;
            }

            // During ad, preserve album view state
            const target = event.target.closest('[data-testid="skip-ad"], .ad-skip-btn');
            if (target) {
              event.preventDefault();
              return false;
            }

            return true;
          }

          // Monitor for album events
          let observer;
          try {
            observer = new MutationObserver(() => {
              handleAlbum({ type: 'album' });
            });
            observer.observe(document.body, { childList: true, subtree: true });
          } catch (e) {}
        })();
      `;
      safeInjectScript(script);
    }
  },

  {
    name: 'artist-protect',
    description: 'Preserves artist view state during ad playback',
    enabled: true,
    async apply() {
      const script = `
        // Artist Protection
        (function() {
          let isArtistOpen = false;

          function handleArtist(event) {
            if (!isArtistOpen && event.type === 'artist') {
              return true;
            }

            // During ad, preserve artist view state
            const target = event.target.closest('[data-testid="skip-ad"], .ad-skip-btn');
            if (target) {
              event.preventDefault();
              return false;
            }

            return true;
          }

          // Monitor for artist events
          let observer;
          try {
            observer = new MutationObserver(() => {
              handleArtist({ type: 'artist' });
            });
            observer.observe(document.body, { childList: true, subtree: true });
          } catch (e) {}
        })();
      `;
      safeInjectScript(script);
    }
  },

  {
    name: 'podcast-protect',
    description: 'Preserves podcast view state during ad playback',
    enabled: true,
    async apply() {
      const script = `
        // Podcast Protection
        (function() {
          let isPodcastOpen = false;

          function handlePodcast(event) {
            if (!isPodcastOpen && event.type === 'podcast') {
              return true;
            }

            // During ad, preserve podcast view state
            const target = event.target.closest('[data-testid="skip-ad"], .ad-skip-btn');
            if (target) {
              event.preventDefault();
              return false;
            }

            return true;
          }

          // Monitor for podcast events
          let observer;
          try {
            observer = new MutationObserver(() => {
              handlePodcast({ type: 'podcast' });
            });
            observer.observe(document.body, { childList: true, subtree: true });
          } catch (e) {}
        })();
      `;
      safeInjectScript(script);
    }
  },

  {
    name: 'radio-protect',
    description: 'Preserves radio view state during ad playback',
    enabled: true,
    async apply() {
      const script = `
        // Radio Protection
        (function() {
          let isRadioOpen = false;

          function handleRadio(event) {
            if (!isRadioOpen && event.type === 'radio') {
              return true;
            }

            // During ad, preserve radio view state
            const target = event.target.closest('[data-testid="skip-ad"], .ad-skip-btn');
            if (target) {
              event.preventDefault();
              return false;
            }

            return true;
          }

          // Monitor for radio events
          let observer;
          try {
            observer = new MutationObserver(() => {
              handleRadio({ type: 'radio' });
            });
            observer.observe(document.body, { childList: true, subtree: true });
          } catch (e) {}
        })();
      `;
      safeInjectScript(script);
    }
  },

  {
    name: 'search-history-protect',
    description: 'Preserves search history during ad playback',
    enabled: true,
    async apply() {
      const script = `
        // Search History Protection
        (function() {
          let isHistoryOpen = false;

          function handleHistory(event) {
            if (!isHistoryOpen && event.type === 'history') {
              return true;
            }

            // During ad, preserve search history state
            const target = event.target.closest('[data-testid="skip-ad"], .ad-skip-btn');
            if (target) {
              event.preventDefault();
              return false;
            }

            return true;
          }

          // Monitor for history events
          let observer;
          try {
            observer = new MutationObserver(() => {
              handleHistory({ type: 'history' });
            });
            observer.observe(document.body, { childList: true, subtree: true });
          } catch (e) {}
        })();
      `;
      safeInjectScript(script);
    }
  },

  {
    name: 'settings-protect',
    description: 'Preserves settings state during ad playback',
    enabled: true,
    async apply() {
      const script = `
        // Settings Protection
        (function() {
          let isSettingsOpen = false;

          function handleSettings(event) {
            if (!isSettingsOpen && event.type === 'settings') {
              return true;
            }

            // During ad, preserve settings state
            const target = event.target.closest('[data-testid="skip-ad"], .ad-skip-btn');
            if (target) {
              event.preventDefault();
              return false;
            }

            return true;
          }

          // Monitor for settings events
          let observer;
          try {
            observer = new MutationObserver(() => {
              handleSettings({ type: 'settings' });
            });
            observer.observe(document.body, { childList: true, subtree: true });
          } catch (e) {}
        })();
      `;
      safeInjectScript(script);
    }
  },

  {
    name: 'profile-protect',
    description: 'Preserves profile state during ad playback',
    enabled: true,
    async apply() {
      const script = `
        // Profile Protection
        (function() {
          let isProfileOpen = false;

          function handleProfile(event) {
            if (!isProfileOpen && event.type === 'profile') {
              return true;
            }

            // During ad, preserve profile state
            const target = event.target.closest('[data-testid="skip-ad"], .ad-skip-btn');
            if (target) {
              event.preventDefault();
              return false;
            }

            return true;
          }

          // Monitor for profile events
          let observer;
          try {
            observer = new MutationObserver(() => {
              handleProfile({ type: 'profile' });
            });
            observer.observe(document.body, { childList: true, subtree: true });
          } catch (e) {}
        })();
      `;
      safeInjectScript(script);
    }
  },

  {
    name: 'help-protect',
    description: 'Preserves help state during ad playback',
    enabled: true,
    async apply() {
      const script = `
        // Help Protection
        (function() {
          let isHelpOpen = false;

          function handleHelp(event) {
            if (!isHelpOpen && event.type === 'help') {
              return true;
            }

            // During ad, preserve help state
            const target = event.target.closest('[data-testid="skip-ad"], .ad-skip-btn');
            if (target) {
              event.preventDefault();
              return false;
            }

            return true;
          }

          // Monitor for help events
          let observer;
          try {
            observer = new MutationObserver(() => {
              handleHelp({ type: 'help' });
            });
            observer.observe(document.body, { childList: true, subtree: true });
          } catch (e) {}
        })();
      `;
      safeInjectScript(script);
    }
  },

  {
    name: 'feedback-protect',
    description: 'Preserves feedback state during ad playback',
    enabled: true,
    async apply() {
      const script = `
        // Feedback Protection
        (function() {
          let isFeedbackOpen = false;

          function handleFeedback(event) {
            if (!isFeedbackOpen && event.type === 'feedback') {
              return true;
            }

            // During ad, preserve feedback state
            const target = event.target.closest('[data-testid="skip-ad"], .ad-skip-btn');
            if (target) {
              event.preventDefault();
              return false;
            }

            return true;
          }

          // Monitor for feedback events
          let observer;
          try {
            observer = new MutationObserver(() => {
              handleFeedback({ type: 'feedback' });
            });
            observer.observe(document.body, { childList: true, subtree: true });
          } catch (e) {}
        })();
      `;
      safeInjectScript(script);
    }
  },

  {
    name: 'about-protect',
    description: 'Preserves about state during ad playback',
    enabled: true,
    async apply() {
      const script = `
        // About Protection
        (function() {
          let isAboutOpen = false;

          function handleAbout(event) {
            if (!isAboutOpen && event.type === 'about') {
              return true;
            }

            // During ad, preserve about state
            const target = event.target.closest('[data-testid="skip-ad"], .ad-skip-btn');
            if (target) {
              event.preventDefault();
              return false;
            }

            return true;
          }

          // Monitor for about events
          let observer;
          try {
            observer = new MutationObserver(() => {
              handleAbout({ type: 'about' });
            });
            observer.observe(document.body, { childList: true, subtree: true });
          } catch (e) {}
        })();
      `;
      safeInjectScript(script);
    }
  },

  {
    name: 'privacy-protect',
    description: 'Preserves privacy settings during ad playback',
    enabled: true,
    async apply() {
      const script = `
        // Privacy Protection
        (function() {
          let isPrivacyOpen = false;

          function handlePrivacy(event) {
            if (!isPrivacyOpen && event.type === 'privacy') {
              return true;
            }

            // During ad, preserve privacy settings state
            const target = event.target.closest('[data-testid="skip-ad"], .ad-skip-btn');
            if (target) {
              event.preventDefault();
              return false;
            }

            return true;
          }

          // Monitor for privacy events
          let observer;
          try {
            observer = new MutationObserver(() => {
              handlePrivacy({ type: 'privacy' });
            });
            observer.observe(document.body, { childList: true, subtree: true });
          } catch (e) {}
        })();
      `;
      safeInjectScript(script);
    }
  },

  {
    name: 'account-protect',
    description: 'Preserves account settings during ad playback',
    enabled: true,
    async apply() {
      const script = `
        // Account Protection
        (function() {
          let isAccountOpen = false;

          function handleAccount(event) {
            if (!isAccountOpen && event.type === 'account') {
              return true;
            }

            // During ad, preserve account settings state
            const target = event.target.closest('[data-testid="skip-ad"], .ad-skip-btn');
            if (target) {
              event.preventDefault();
              return false;
            }

            return true;
          }

          // Monitor for account events
          let observer;
          try {
            observer = new MutationObserver(() => {
              handleAccount({ type: 'account' });
            });
            observer.observe(document.body, { childList: true, subtree: true });
          } catch (e) {}
        })();
      `;
      safeInjectScript(script);
    }
  },

  {
    name: 'billing-protect',
    description: 'Preserves billing settings during ad playback',
    enabled: true,
    async apply() {
      const script = `
        // Billing Protection
        (function() {
          let isBillingOpen = false;

          function handleBilling(event) {
            if (!isBillingOpen && event.type === 'billing') {
              return true;
            }

            // During ad, preserve billing settings state
            const target = event.target.closest('[data-testid="skip-ad"], .ad-skip-btn');
            if (target) {
              event.preventDefault();
              return false;
            }

            return true;
          }

          // Monitor for billing events
          let observer;
          try {
            observer = new MutationObserver(() => {
              handleBilling({ type: 'billing' });
            });
            observer.observe(document.body, { childList: true, subtree: true });
          } catch (e) {}
        })();
      `;
      safeInjectScript(script);
    }
  },

  {
    name: 'subscription-protect',
    description: 'Preserves subscription settings during ad playback',
    enabled: true,
    async apply() {
      const script = `
        // Subscription Protection
        (function() {
          let isSubscriptionOpen = false;

          function handleSubscription(event) {
            if (!isSubscriptionOpen && event.type === 'subscription') {
              return true;
            }

            // During ad, preserve subscription settings state
            const target = event.target.closest('[data-testid="skip-ad"], .ad-skip-btn');
            if (target) {
              event.preventDefault();
              return false;
            }

            return true;
          }

          // Monitor for subscription events
          let observer;
          try {
            observer = new MutationObserver(() => {
              handleSubscription({ type: 'subscription' });
            });
            observer.observe(document.body, { childList: true, subtree: true });
          } catch (e) {}
        })();
      `;
      safeInjectScript(script);
    }
  },

  {
    name: 'preferences-protect',
    description: 'Preserves preferences during ad playback',
    enabled: true,
    async apply() {
      const script = `
        // Preferences Protection
        (function() {
          let isPreferencesOpen = false;

          function handlePreferences(event) {
            if (!isPreferencesOpen && event.type === 'preferences') {
              return true;
            }

            // During ad, preserve preferences state
            const target = event.target.closest('[data-testid="skip-ad"], .ad-skip-btn');
            if (target) {
              event.preventDefault();
              return false;
            }

            return true;
          }

          // Monitor for preferences events
          let observer;
          try {
            observer = new MutationObserver(() => {
              handlePreferences({ type: 'preferences' });
            });
            observer.observe(document.body, { childList: true, subtree: true });
          } catch (e) {}
        })();
      `;
      safeInjectScript(script);
    }
  },

  {
    name: 'notifications-protect',
    description: 'Preserves notification settings during ad playback',
    enabled: true,
    async apply() {
      const script = `
        // Notifications Protection
        (function() {
          let isNotificationsOpen = false;

          function handleNotifications(event) {
            if (!isNotificationsOpen && event.type === 'notifications') {
              return true;
            }

            // During ad, preserve notification settings state
            const target = event.target.closest('[data-testid="skip-ad"], .ad-skip-btn');
            if (target) {
              event.preventDefault();
              return false;
            }

            return true;
          }

          // Monitor for notifications events
          let observer;
          try {
            observer = new MutationObserver(() => {
              handleNotifications({ type: 'notifications' });
            });
            observer.observe(document.body, { childList: true, subtree: true });
          } catch (e) {}
        })();
      `;
      safeInjectScript(script);
    }
  },

  {
    name: 'language-protect',
    description: 'Preserves language settings during ad playback',
    enabled: true,
    async apply() {
      const script = `
        // Language Protection
        (function() {
          let isLanguageOpen = false;

          function handleLanguage(event) {
            if (!isLanguageOpen && event.type === 'language') {
              return true;
            }

            // During ad, preserve language settings state
            const target = event.target.closest('[data-testid="skip-ad"], .ad-skip-btn');
            if (target) {
              event.preventDefault();
              return false;
            }

            return true;
          }

          // Monitor for language events
          let observer;
          try {
            observer = new MutationObserver(() => {
              handleLanguage({ type: 'language' });
            });
            observer.observe(document.body, { childList: true, subtree: true });
          } catch (e) {}
        })();
      `;
      safeInjectScript(script);
    }
  },

  {
    name: 'theme-protect',
    description: 'Preserves theme settings during ad playback',
    enabled: true,
    async apply() {
      const script = `
        // Theme Protection
        (function() {
          let isThemeOpen = false;

          function handleTheme(event) {
            if (!isThemeOpen && event.type === 'theme') {
              return true;
            }

            // During ad, preserve theme settings state
            const target = event.target.closest('[data-testid="skip-ad"], .ad-skip-btn');
            if (target) {
              event.preventDefault();
              return false;
            }

            return true;
          }

          // Monitor for theme events
          let observer;
          try {
            observer = new MutationObserver(() => {
              handleTheme({ type: 'theme' });
            });
            observer.observe(document.body, { childList: true, subtree: true });
          } catch (e) {}
        })();
      `;
      safeInjectScript(script);
    }
  },

  {
    name: 'display-protect',
    description: 'Preserves display settings during ad playback',
    enabled: true,
    async apply() {
      const script = `
        // Display Protection
        (function() {
          let isDisplayOpen = false;

          function handleDisplay(event) {
            if (!isDisplayOpen && event.type === 'display') {
              return true;
            }

            // During ad, preserve display settings state
            const target = event.target.closest('[data-testid="skip-ad"], .ad-skip-btn');
            if (target) {
              event.preventDefault();
              return false;
            }

            return true;
          }

          // Monitor for display events
          let observer;
          try {
            observer = new MutationObserver(() => {
              handleDisplay({ type: 'display' });
            });
            observer.observe(document.body, { childList: true, subtree: true });
          } catch (e) {}
        })();
      `;
      safeInjectScript(script);
    }
  },

  {
    name: 'audio-protect',
    description: 'Preserves audio settings during ad playback',
    enabled: true,
    async apply() {
      const script = `
        // Audio Protection
        (function() {
          let isAudioOpen = false;

          function handleAudio(event) {
            if (!isAudioOpen && event.type === 'audio') {
              return true;
            }

            // During ad, preserve audio settings state
            const target = event.target.closest('[data-testid="skip-ad"], .ad-skip-btn');
            if (target) {
              event.preventDefault();
              return false;
            }

            return true;
          }

          // Monitor for audio events
          let observer;
          try {
            observer = new MutationObserver(() => {
              handleAudio({ type: 'audio' });
            });
            observer.observe(document.body, { childList: true, subtree: true });
          } catch (e) {}
        })();
      `;
      safeInjectScript(script);
    }
  },

  {
    name: 'video-protect',
    description: 'Preserves video settings during ad playback',
    enabled: true,
    async apply() {
      const script = `
        // Video Protection
        (function() {
          let isVideoOpen = false;

          function handleVideo(event) {
            if (!isVideoOpen && event.type === 'video') {
              return true;
            }

            // During ad, preserve video settings state
            const target = event.target.closest('[data-testid="skip-ad"], .ad-skip-btn');
            if (target) {
              event.preventDefault();
              return false;
            }

            return true;
          }

          // Monitor for video events
          let observer;
          try {
            observer = new MutationObserver(() => {
              handleVideo({ type: 'video' });
            });
            observer.observe(document.body, { childList: true, subtree: true });
          } catch (e) {}
        })();
      `;
      safeInjectScript(script);
    }
  },

  {
    name: 'misc-protect',
    description: 'Preserves miscellaneous settings during ad playback',
    enabled: true,
    async apply() {
      const script = `
        // Miscellaneous Protection
        (function() {
          let isMiscOpen = false;

          function handleMisc(event) {
            if (!isMiscOpen && event.type === 'misc') {
              return true;
            }

            // During ad, preserve miscellaneous settings state
            const target = event.target.closest('[data-testid="skip-ad"], .ad-skip-btn');
            if (target) {
              event.preventDefault();
              return false;
            }

            return true;
          }

          // Monitor for misc events
          let observer;
          try {
            observer = new MutationObserver(() => {
              handleMisc({ type: 'misc' });
            });
            observer.observe(document.body, { childList: true, subtree: true });
          } catch (e) {}
        })();
      `;
      safeInjectScript(script);
    }
  },
];

export function getAudioPlayerMods(config?: Partial<AdBlockConfig>): AudioPlayerMod[] {
  return AUDIO_PLAYER_MODS.filter(mod => !config?.disableMods || mod.enabled);
}

export default { getAudioPlayerMods, AUDIO_PLAYER_MODS };