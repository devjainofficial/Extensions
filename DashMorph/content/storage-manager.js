// DashMorph Storage Manager
// Handles fingerprinting, chrome.storage.local, and window.localStorage persistence

class DashMorphStorage {
  constructor() {
    this.storagePrefix = 'dashmorph_layout:';
  }

  // Get canonical URL key for the current page
  getPageKey(url = window.location.href) {
    try {
      const u = new URL(url);
      return `${this.storagePrefix}${u.origin}${u.pathname}`;
    } catch {
      return `${this.storagePrefix}${window.location.host}${window.location.pathname}`;
    }
  }

  // Clean a text string for identifier usage
  slugify(text) {
    return (text || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 32);
  }

  // Generate a robust structural & semantic fingerprint for a card element
  createCardFingerprint(cardEl, index) {
    if (!cardEl || cardEl.nodeType !== Node.ELEMENT_NODE) return null;

    // 1. Check for headings or primary title elements
    let headingText = '';
    const headingEl = cardEl.querySelector('h1, h2, h3, h4, h5, h6, [class*="title" i], [class*="header" i], [class*="heading" i]');
    if (headingEl) {
      headingText = headingEl.innerText?.trim().slice(0, 80) || '';
    }

    // 2. Sample first significant text content
    let sampleText = '';
    const textNodes = [];
    const walker = document.createTreeWalker(cardEl, NodeFilter.SHOW_TEXT, null, false);
    let node;
    while ((node = walker.nextNode()) && textNodes.length < 5) {
      const val = node.nodeValue.trim();
      if (val && !val.startsWith('⋮⋮') && !val.includes('DashMorph')) {
        textNodes.push(val);
      }
    }
    sampleText = textNodes.slice(0, 3).join(' | ').slice(0, 100);

    // 3. Collect stable data attributes
    const stableDataAttrs = {};
    for (const attr of cardEl.attributes) {
      if (attr.name.startsWith('data-') && !attr.name.startsWith('data-dashmorph')) {
        stableDataAttrs[attr.name] = attr.value;
      }
    }

    // 4. Stable class name signature
    const classList = Array.from(cardEl.classList).filter(c => 
      !c.startsWith('dashmorph-') && 
      !c.startsWith('hover:') && 
      !c.startsWith('focus:') &&
      !/^_[a-z0-9]{5,}/i.test(c)
    );

    // 5. Existing ID if non-dynamic
    let stableId = '';
    if (cardEl.id && !/^(:r|rc-|_)/.test(cardEl.id)) {
      stableId = cardEl.id;
    }

    // 6. Deterministic Identifier based on stable attributes or content
    let deterministicSlug = stableId || 
                            stableDataAttrs['data-card-id'] || 
                            stableDataAttrs['data-testid'] || 
                            this.slugify(headingText) || 
                            this.slugify(sampleText) || 
                            `card_${cardEl.tagName.toLowerCase()}_${index}`;

    const assignedId = cardEl.getAttribute('data-dashmorph-id') || `dm_${deterministicSlug}`;
    cardEl.setAttribute('data-dashmorph-id', assignedId);

    return {
      id: assignedId,
      stableId,
      tag: cardEl.tagName,
      heading: headingText,
      sampleText,
      classes: classList.slice(0, 12).join(' '),
      dataAttrs: stableDataAttrs,
      originalIndex: index,
      hidden: cardEl.style.display === 'none' || cardEl.classList.contains('dashmorph-hidden')
    };
  }

  // Get a unique CSS selector path for a container element
  getContainerSelector(element) {
    if (!element || element.nodeType !== Node.ELEMENT_NODE) return null;
    if (element.id && !/^(:r|rc-|_)/.test(element.id)) {
      return `#${CSS.escape(element.id)}`;
    }

    const path = [];
    let current = element;
    while (current && current.nodeType === Node.ELEMENT_NODE && current !== document.body && current !== document.documentElement) {
      let selector = current.tagName.toLowerCase();
      if (current.id && !/^(:r|rc-|_)/.test(current.id)) {
        selector = `#${CSS.escape(current.id)}`;
        path.unshift(selector);
        break;
      }

      let distinctAttr = null;
      for (const attr of current.attributes) {
        if (['data-testid', 'data-component', 'data-section', 'role', 'aria-label'].includes(attr.name)) {
          distinctAttr = `[${attr.name}="${CSS.escape(attr.value)}"]`;
          break;
        }
      }

      if (distinctAttr) {
        selector += distinctAttr;
      } else {
        let sibling = current;
        let nth = 1;
        while ((sibling = sibling.previousElementSibling)) {
          if (sibling.tagName === current.tagName) nth++;
        }
        selector += `:nth-of-type(${nth})`;
      }

      path.unshift(selector);
      current = current.parentElement;
    }

    return path.join(' > ');
  }

  // Save current arrangement for containers on the page
  async saveLayout(containerLayouts) {
    const pageKey = this.getPageKey();
    const payload = {
      version: 1,
      url: window.location.href,
      pageKey,
      savedAt: Date.now(),
      containers: containerLayouts
    };

    // 1. Save to window.localStorage
    try {
      window.localStorage.setItem(pageKey, JSON.stringify(payload));
      const indexRaw = window.localStorage.getItem('dashmorph_saved_pages');
      const pageIndex = indexRaw ? JSON.parse(indexRaw) : {};
      pageIndex[pageKey] = {
        url: window.location.href,
        savedAt: Date.now(),
        cardCount: containerLayouts.reduce((acc, c) => acc + (c.cards ? c.cards.length : 0), 0)
      };
      window.localStorage.setItem('dashmorph_saved_pages', JSON.stringify(pageIndex));
    } catch (e) {
      console.warn('[DashMorph] localStorage write warning:', e);
    }

    // 2. Save to chrome.storage.local
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      try {
        await chrome.storage.local.set({ [pageKey]: payload });
        const { dashmorph_sites = {} } = await chrome.storage.local.get('dashmorph_sites');
        dashmorph_sites[pageKey] = {
          url: window.location.href,
          title: document.title,
          savedAt: Date.now(),
          cardCount: containerLayouts.reduce((acc, c) => acc + (c.cards ? c.cards.length : 0), 0)
        };
        await chrome.storage.local.set({ dashmorph_sites });
      } catch (e) {
        console.warn('[DashMorph] chrome.storage write warning:', e);
      }
    }

    return payload;
  }

  // Load saved arrangement for the current page
  async loadLayout() {
    const pageKey = this.getPageKey();

    // 1. Try chrome.storage.local first
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      try {
        const res = await chrome.storage.local.get(pageKey);
        if (res && res[pageKey]) {
          return res[pageKey];
        }
      } catch (e) {
        console.warn('[DashMorph] chrome.storage read warning:', e);
      }
    }

    // 2. Fallback to window.localStorage
    try {
      const raw = window.localStorage.getItem(pageKey);
      if (raw) {
        return JSON.parse(raw);
      }
    } catch (e) {
      console.warn('[DashMorph] localStorage read warning:', e);
    }

    return null;
  }

  // Clear saved layout for the current page
  async clearLayout() {
    const pageKey = this.getPageKey();

    // Remove from localStorage
    try {
      window.localStorage.removeItem(pageKey);
      const indexRaw = window.localStorage.getItem('dashmorph_saved_pages');
      if (indexRaw) {
        const pageIndex = JSON.parse(indexRaw);
        delete pageIndex[pageKey];
        window.localStorage.setItem('dashmorph_saved_pages', JSON.stringify(pageIndex));
      }
    } catch (e) {
      console.warn('[DashMorph] localStorage remove warning:', e);
    }

    // Remove from chrome.storage
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      try {
        await chrome.storage.local.remove(pageKey);
        const { dashmorph_sites = {} } = await chrome.storage.local.get('dashmorph_sites');
        delete dashmorph_sites[pageKey];
        await chrome.storage.local.set({ dashmorph_sites });
      } catch (e) {
        console.warn('[DashMorph] chrome.storage remove warning:', e);
      }
    }
  }

  // Score match similarity between a saved card fingerprint and a live DOM element
  scoreElementMatch(fingerprint, element) {
    if (!fingerprint || !element) return -1;
    let score = 0;

    // Exact ID match
    if (fingerprint.id && element.getAttribute('data-dashmorph-id') === fingerprint.id) {
      return 1000;
    }
    if (fingerprint.stableId && element.id === fingerprint.stableId) {
      score += 500;
    }

    // Tag name must match
    if (element.tagName !== fingerprint.tag) {
      return -1;
    }

    // Heading match
    if (fingerprint.heading) {
      const headingEl = element.querySelector('h1, h2, h3, h4, h5, h6, [class*="title" i], [class*="header" i], [class*="heading" i]');
      const headingText = headingEl ? headingEl.innerText?.trim() : '';
      if (headingText && headingText === fingerprint.heading) {
        score += 300;
      } else if (headingText && (headingText.includes(fingerprint.heading) || fingerprint.heading.includes(headingText))) {
        score += 150;
      }
    }

    // Data attributes match
    if (fingerprint.dataAttrs) {
      for (const [key, val] of Object.entries(fingerprint.dataAttrs)) {
        if (element.getAttribute(key) === val) {
          score += 150;
        }
      }
    }

    // Text content sample match
    if (fingerprint.sampleText) {
      const currentText = element.innerText || '';
      const sampleWords = fingerprint.sampleText.split('|').map(s => s.trim()).filter(Boolean);
      for (const word of sampleWords) {
        if (currentText.includes(word)) {
          score += 40;
        }
      }
    }

    // Classes match
    if (fingerprint.classes) {
      const savedClasses = fingerprint.classes.split(' ');
      let classMatches = 0;
      for (const cls of savedClasses) {
        if (element.classList.contains(cls)) {
          classMatches++;
        }
      }
      score += Math.min(classMatches * 10, 50);
    }

    return score;
  }
}

// Export singleton instance
window.DashMorphStorageInstance = new DashMorphStorage();
