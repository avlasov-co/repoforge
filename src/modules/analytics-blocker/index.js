/**
 * Analytics Blocking Module
 * 
 * Blocks tracking and analytics scripts that Spotify uses to monitor user behavior.
 */

import { safeInjectScript } from '../utils/safe-injector.js';

export interface AnalyticsBlocker {
  init(): Promise<void>;
  blockTrackers(): void;
  unblockTrackers(): void;
  getBlockedTrackers(): string[];
}

const TRACKER_PATTERNS = [
  // Google Analytics
  /google\.analytics/i,
  /gtag\(/i,
  /ga\(\d{2},/i,
  /analytics\.googleapis/i,
  
  // Facebook Pixel
  /facebook\.com\/plugins\/pixel/i,
  /fbq\(/i,
  
  // Twitter Ads
  /twitter\.com\/js\/tweetbutton/i,
  
  // LinkedIn Insight Tag
  /linkedin\.com\/insighttag/i,
  
  // Pinterest Tag
  /pinterest\.com\/embed\/pin/tag/i,
  
  // YouTube Analytics
  /youtube\.com\/oembed/i,
  
  // Custom Spotify trackers
  /spotify\.com\/analytics/i,
  /track\.spotify/i,
  /events\.spotify/i,
  
  // General tracking patterns
  /(track|monitor|observe)\(/i,
  /(collect|send|report)\(/i,
];

export class AnalyticsBlocker implements AnalyticsBlocker {
  private blockedTrackers: Set<string> = new Set();
  private observer: MutationObserver | null = null;

  async init(): Promise<void> {
    console.log('[AnalyticsBlocker] Initializing...');

    // Block existing trackers
    this.blockTrackers();

    // Monitor for new trackers
    this.startMonitoring();

    console.log('[AnalyticsBlocker] Initialization complete');
  }

  private blockTrackers(): void {
    const script = `
      // Analytics Tracker Blocker
      (function() {
        function removeTracker(element) {
          if (!element || !element.outerHTML.includes('analytics') && 
              !element.outerHTML.includes('track')) return;

          element.remove();
        }

        // Remove existing trackers
        document.querySelectorAll('[data-testid*="analytics"], [class*="track"]').forEach(removeTracker);

        // Monitor for new trackers
        let observer;
        try {
          observer = new MutationObserver(() => {
            const newTrackers = document.querySelectorAll('[data-testid*="analytics"], [class*="track"]');
            newTrackers.forEach(removeTracker);
          });
          
          observer.observe(document.body, { childList: true, subtree: true });
        } catch (e) {}
      })();
    `;

    safeInjectScript(script);
  }

  private startMonitoring(): void {
    const script = `
      // Continuous Tracker Monitoring
      (function() {
        function checkForTrackers() {
          const trackerSelectors = [
            '[data-testid*="analytics"]',
            '[class*="track"]',
            '[data-adsense]',
            '[data-pixel]'
          ];

          let foundTracker = false;

          trackerSelectors.forEach(selector => {
            const elements = document.querySelectorAll(selector);
            if (elements.length > 0) {
              foundTracker = true;
              elements.forEach(el => el.remove());
            }
          });

          return foundTracker;
        }

        // Check periodically and on DOM mutations
        setInterval(checkForTrackers, 3000);

        let observer;
        try {
          observer = new MutationObserver(() => {
            checkForTrackers();
          });
          
          observer.observe(document.body, { childList: true, subtree: true });
        } catch (e) {}
      })();
    `;

    safeInjectScript(script);
  }

  unblockTrackers(): void {
    console.log('[AnalyticsBlocker] Unblocking trackers...');
    
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }

    // Remove all tracker-related scripts
    document.querySelectorAll('script[data-tracker]').forEach(script => script.remove());
  }

  getBlockedTrackers(): string[] {
    return Array.from(this.blockedTrackers);
  }
}

export default AnalyticsBlocker;