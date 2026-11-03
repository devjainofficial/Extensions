// DashMorph Card & Container Detector
// Intelligently scans DOM for dashboard layouts, cards, widgets, and grid/flex containers

class DashMorphDetector {
  constructor() {
    this.excludedTags = new Set(['SCRIPT', 'STYLE', 'SVG', 'PATH', 'IFRAME', 'NOSCRIPT', 'NAV', 'HEADER', 'FOOTER']);
    this.pickerActive = false;
    this.pickerCallback = null;
    this.hoveredPickerEl = null;

    this.initPickerEvents();
  }

  // Check if an element should be ignored (e.g. navbars, HUD, tooltips)
  isExcluded(el) {
    if (!el || el.nodeType !== Node.ELEMENT_NODE) return true;
    if (this.excludedTags.has(el.tagName)) return true;
    if (el.closest('#dashmorph-hud-root, .dashmorph-ignore, [data-dashmorph-ui]')) return true;

    // Exclude fixed sidebars, top headers, small navigation bars
    const style = window.getComputedStyle(el);
    if (style.position === 'fixed' && (el.offsetWidth < 260 || el.offsetHeight < 70)) {
      return true;
    }
    return false;
  }

  // Test if an element looks like a card or widget
  isCardElement(el) {
    if (this.isExcluded(el)) return false;

    // Minimum size requirements for a dashboard card
    const rect = el.getBoundingClientRect();
    if (rect.width < 120 || rect.height < 50) return false;

    // Exclude if it fills 100% of body and has no siblings
    if (el.parentElement === document.body && rect.height > window.innerHeight * 0.95 && el.parentElement.children.length === 1) {
      return false;
    }

    const className = (typeof el.className === 'string' ? el.className : '').toLowerCase();
    const style = window.getComputedStyle(el);

    // Explicit card/widget naming
    const cardKeywords = ['card', 'widget', 'panel', 'tile', 'box', 'module', 'section', 'block', 'container'];
    const hasCardClass = cardKeywords.some(kw => className.includes(kw));

    // Visual card heuristics (border, shadow, rounded corners, distinct background)
    const hasShadow = style.boxShadow && style.boxShadow !== 'none';
    const hasBorder = style.borderWidth && parseFloat(style.borderWidth) > 0 && style.borderStyle !== 'none';
    const hasRadius = style.borderRadius && parseFloat(style.borderRadius) >= 4;
    const hasBg = style.backgroundColor && style.backgroundColor !== 'rgba(0, 0, 0, 0)' && style.backgroundColor !== 'transparent';

    if (hasCardClass) return true;
    if ((hasShadow || hasBorder) && (hasRadius || hasBg)) return true;

    // Check if it's a direct child of a grid or flex container with sibling cards
    const parent = el.parentElement;
    if (parent) {
      const pStyle = window.getComputedStyle(parent);
      if (pStyle.display === 'grid' || pStyle.display === 'flex') {
        const siblings = Array.from(parent.children).filter(c => !this.isExcluded(c));
        if (siblings.length >= 2) {
          // If at least one sibling or this element has significant height/width
          return rect.height >= 70 && rect.width >= 140;
        }
      }
    }

    return false;
  }

  // Detect dashboard containers and their draggable card children
  detectContainers() {
    const containersMap = new Map();
    const allElements = document.querySelectorAll('main, [role="main"], article, section, div');

    allElements.forEach(container => {
      if (this.isExcluded(container)) return;

      const style = window.getComputedStyle(container);
      const isGridOrFlex = style.display === 'grid' || 
                           style.display === 'flex' || 
                           container.classList.contains('grid') || 
                           container.classList.contains('flex');

      // Filter candidate children
      const children = Array.from(container.children).filter(child => {
        if (this.isExcluded(child)) return false;
        // Ignore HUD or overlays
        if (child.classList.contains('dashmorph-drag-ghost') || child.classList.contains('dashmorph-drop-slot')) return false;
        return true;
      });

      // Must have at least 2 children to be rearranged
      if (children.length < 2) return;

      // Check how many children meet card criteria
      const cardChildren = children.filter(c => this.isCardElement(c));
      
      // If majority of children or at least 2 are cards, or it is explicitly a grid/flex container
      if ((cardChildren.length >= 2) || (isGridOrFlex && children.length >= 2 && children.every(c => c.offsetHeight > 50))) {
        // Avoid adding ancestors if a tighter descendant container already captures the same cards
        const validCards = cardChildren.length >= 2 ? cardChildren : children;
        
        // Ensure card elements are not tiny inline items
        const substantialCards = validCards.filter(c => {
          const r = c.getBoundingClientRect();
          return r.width >= 100 && r.height >= 40;
        });

        if (substantialCards.length >= 2) {
          containersMap.set(container, substantialCards);
        }
      }
    });

    // Deduplicate: filter out parent containers whose children are strictly sub-containers already tracked
    const filteredContainers = [];
    for (const [container, cards] of containersMap.entries()) {
      let isRedundantAncestor = false;
      for (const [otherContainer] of containersMap.entries()) {
        if (container !== otherContainer && container.contains(otherContainer)) {
          // If container's cards are just other containers, keep only the specific one
          const directSubContainers = cards.filter(c => c.contains(otherContainer) || c === otherContainer);
          if (directSubContainers.length >= cards.length / 2) {
            // Keep the specific sub-container instead
            // isRedundantAncestor = true;
          }
        }
      }

      const selector = window.DashMorphStorageInstance.getContainerSelector(container);
      filteredContainers.push({
        element: container,
        selector,
        cards
      });
    }

    return filteredContainers;
  }

  // Setup picker mode events (for manual user selection of any element)
  initPickerEvents() {
    this.handleMouseMove = (e) => {
      if (!this.pickerActive) return;
      e.stopPropagation();

      const target = document.elementFromPoint(e.clientX, e.clientY);
      if (!target || target.closest('#dashmorph-hud-root')) return;

      if (this.hoveredPickerEl && this.hoveredPickerEl !== target) {
        this.hoveredPickerEl.classList.remove('dashmorph-picker-highlight');
      }

      this.hoveredPickerEl = target;
      this.hoveredPickerEl.classList.add('dashmorph-picker-highlight');
    };

    this.handleClick = (e) => {
      if (!this.pickerActive) return;
      e.preventDefault();
      e.stopPropagation();

      const picked = this.hoveredPickerEl;
      this.stopPicker();

      if (picked && this.pickerCallback) {
        this.pickerCallback(picked);
      }
    };

    this.handleKeyDown = (e) => {
      if (this.pickerActive && e.key === 'Escape') {
        this.stopPicker();
      }
    };
  }

  startPicker(callback) {
    this.pickerActive = true;
    this.pickerCallback = callback;
    document.body.classList.add('dashmorph-picker-cursor');
    document.addEventListener('mousemove', this.handleMouseMove, true);
    document.addEventListener('click', this.handleClick, true);
    document.addEventListener('keydown', this.handleKeyDown, true);
  }

  stopPicker() {
    this.pickerActive = false;
    document.body.classList.remove('dashmorph-picker-cursor');
    if (this.hoveredPickerEl) {
      this.hoveredPickerEl.classList.remove('dashmorph-picker-highlight');
      this.hoveredPickerEl = null;
    }
    document.removeEventListener('mousemove', this.handleMouseMove, true);
    document.removeEventListener('click', this.handleClick, true);
    document.removeEventListener('keydown', this.handleKeyDown, true);
  }
}

// Export singleton
window.DashMorphDetectorInstance = new DashMorphDetector();
