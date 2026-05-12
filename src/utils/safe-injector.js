/**
 * Safe Script Injector Utility
 * 
 * Provides safe methods for injecting JavaScript into the DOM without
 * breaking existing functionality or causing security issues.
 */

export interface InjectOptions {
  timeout?: number;
  onError?: (error: Error) => void;
  waitForReady?: boolean;
}

export function safeInjectScript(
  code: string,
  options: InjectOptions = {}
): Promise<void> {
  return new Promise((resolve, reject) => {
    const { timeout = 5000, onError } = options;

    // Check if script already exists
    if (document.querySelector(`script[data-injected="true"]`)) {
      resolve();
      return;
    }

    // Create a blob URL for the code
    const blob = new Blob([code], { type: 'application/javascript' });
    const url = URL.createObjectURL(blob);

    // Create script element
    const script = document.createElement('script');
    script.src = url;
    script.dataset.injected = 'true';
    
    // Add error handling
    script.onerror = () => {
      cleanup();
      reject(new Error('Failed to inject script'));
    };

    // Timeout handling
    const timer = setTimeout(() => {
      cleanup();
      resolve();
    }, timeout);

    function cleanup() {
      clearTimeout(timer);
      URL.revokeObjectURL(url);
    }

    // Inject into document head
    document.head.appendChild(script);

    // Wait for script to load
    script.onload = () => {
      cleanup();
      resolve();
    };

    script.onabort = () => {
      cleanup();
      reject(new Error('Script injection aborted'));
    };
  });
}

export function injectCSS(css: string, id?: string): void {
  const styleId = id || `adblock-style-${Date.now()}`;
  
  // Check if already exists
  if (document.getElementById(styleId)) return;

  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = css;
  document.head.appendChild(style);
}

export function injectShadowDOM(
  selector: string,
  html: string,
  options?: { isolate?: boolean }
): HTMLElement | null {
  const element = document.querySelector(selector);
  if (!element) return null;

  // Create shadow DOM for isolation
  const shadowRoot = element.attachShadow({ mode: 'open' });
  
  const div = document.createElement('div');
  div.innerHTML = html;
  shadowRoot.appendChild(div.firstElementChild);

  return div.firstElementChild as HTMLElement;
}

export function createMutationObserver(
  callback: MutationCallback,
  options?: MutationObserverInit
): MutationObserver {
  const observer = new MutationObserver(callback);
  
  // Observe common Spotify containers
  const targets = [
    'body',
    '[data-testid="app-root"]',
    '.spotify-app'
  ];

  targets.forEach(target => {
    try {
      observer.observe(document.querySelector(target) || document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class', 'data-testid'],
        ...options
      });
    } catch (e) {
      // Ignore errors for non-existent elements
    }
  });

  return observer;
}

export function cleanupInjectedScripts(): void {
  const scripts = document.querySelectorAll('script[data-injected="true"]');
  scripts.forEach(script => script.remove());
}

export function isScriptSafe(code: string): boolean {
  // Basic safety checks
  const dangerousPatterns = [
    /eval\(/i,
    /Function\(/i,
    /document\.write/i,
    /innerHTML\s*=/i,
    /outerHTML\s*=/i,
    /delete\s+window\./i,
    /delete\s+document\./i
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(code)) {
      return false;
    }
  }

  return true;
}

export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    
    timeout = setTimeout(() => {
      func(...args);
    }, wait);
  };
}

export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;

  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

export default {
  safeInjectScript,
  injectCSS,
  injectShadowDOM,
  createMutationObserver,
  cleanupInjectedScripts,
  isScriptSafe,
  debounce,
  throttle
};