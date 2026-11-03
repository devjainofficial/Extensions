// DashMorph Drag & Drop Engine
// Provides drag handles, smooth ghost preview, live drop slot indicators, cross-container drop, and DOM reordering

class DashMorphDragEngine {
  constructor() {
    this.isActive = false;
    this.activeContainers = [];
    this.draggedCard = null;
    this.dragGhost = null;
    this.dropSlot = null;
    this.currentDropTarget = null;
    this.dropPosition = 'before'; // 'before' | 'after' | 'end'
    this.dragStartX = 0;
    this.dragStartY = 0;
    this.hasMoved = false;

    // Bind event handlers
    this.handlePointerDown = this.handlePointerDown.bind(this);
    this.handlePointerMove = this.handlePointerMove.bind(this);
    this.handlePointerUp = this.handlePointerUp.bind(this);
  }

  // Activate rearrange mode across all detected containers
  enableRearrangeMode(containers) {
    if (this.isActive) this.disableRearrangeMode();
    this.isActive = true;
    this.activeContainers = containers;

    document.body.classList.add('dashmorph-mode-active');

    containers.forEach(({ element: container, cards }) => {
      container.classList.add('dashmorph-container-active');
      container.setAttribute('data-dashmorph-container', 'true');

      cards.forEach((card, index) => {
        card.classList.add('dashmorph-card-active');
        card.setAttribute('data-dashmorph-card', 'true');

        // Check if card already has a handle, if not inject it
        let handle = card.querySelector(':scope > .dashmorph-card-handle');
        if (!handle) {
          handle = this.createCardHandle(card, index);
          card.prepend(handle);
        }
      });
    });

    document.addEventListener('pointerdown', this.handlePointerDown, true);
  }

  // Disable rearrange mode and clean up handles
  disableRearrangeMode() {
    this.isActive = false;
    document.body.classList.remove('dashmorph-mode-active');
    document.removeEventListener('pointerdown', this.handlePointerDown, true);
    this.cleanupDrag();

    document.querySelectorAll('.dashmorph-card-handle').forEach(h => h.remove());
    document.querySelectorAll('.dashmorph-container-active').forEach(c => c.classList.remove('dashmorph-container-active'));
    document.querySelectorAll('.dashmorph-card-active').forEach(c => c.classList.remove('dashmorph-card-active'));
  }

  // Extract a readable title for the card
  getCardTitle(cardEl) {
    const heading = cardEl.querySelector('h1, h2, h3, h4, h5, h6, [class*="title" i], [class*="header" i]');
    if (heading && heading.innerText.trim()) {
      return heading.innerText.trim().slice(0, 24);
    }
    const walker = document.createTreeWalker(cardEl, NodeFilter.SHOW_TEXT, null, false);
    let node;
    while ((node = walker.nextNode())) {
      const t = node.nodeValue.trim();
      if (t && !t.startsWith('⋮⋮') && !t.includes('DashMorph')) {
        return t.slice(0, 24);
      }
    }
    return 'Dashboard Card';
  }

  // Create drag handle overlay bar for a card
  createCardHandle(cardEl, index) {
    const handle = document.createElement('div');
    handle.className = 'dashmorph-card-handle dashmorph-ignore';
    handle.setAttribute('contenteditable', 'false');

    const title = this.getCardTitle(cardEl);

    handle.innerHTML = `
      <div class="dashmorph-handle-grip" title="Click and drag to rearrange">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="8" cy="6" r="2.5"/><circle cx="16" cy="6" r="2.5"/>
          <circle cx="8" cy="12" r="2.5"/><circle cx="16" cy="12" r="2.5"/>
          <circle cx="8" cy="18" r="2.5"/><circle cx="16" cy="18" r="2.5"/>
        </svg>
        <span class="dashmorph-handle-label">${this.escapeHtml(title)}</span>
      </div>
      <div class="dashmorph-handle-actions">
        <button type="button" class="dashmorph-handle-btn dashmorph-btn-minimize" title="Collapse / Expand">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
        </button>
        <button type="button" class="dashmorph-handle-btn dashmorph-btn-hide" title="Hide this card">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
    `;

    // Handle minimize/collapse
    const minBtn = handle.querySelector('.dashmorph-btn-minimize');
    minBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      cardEl.classList.toggle('dashmorph-card-collapsed');
    });

    // Handle hide card
    const hideBtn = handle.querySelector('.dashmorph-btn-hide');
    hideBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.hideCard(cardEl);
    });

    return handle;
  }

  escapeHtml(str) {
    const div = document.createElement('div');
    div.innerText = str;
    return div.innerHTML;
  }

  // Hide a card and trigger layout save
  hideCard(cardEl) {
    cardEl.style.display = 'none';
    cardEl.classList.add('dashmorph-hidden');
    this.triggerAutoSave();
    if (window.DashMorphHUDInstance) {
      window.DashMorphHUDInstance.showToast('Card hidden. You can restore it from the HUD.');
      window.DashMorphHUDInstance.updateHiddenCount();
    }
  }

  // Pointer Down: Initialize dragging
  handlePointerDown(e) {
    if (!this.isActive) return;

    const handle = e.target.closest('.dashmorph-card-handle');
    if (!handle) return;
    if (e.target.closest('.dashmorph-handle-btn')) return;

    const card = handle.closest('[data-dashmorph-card="true"]');
    if (!card) return;

    e.preventDefault();
    e.stopPropagation();

    this.draggedCard = card;
    this.dragStartX = e.clientX;
    this.dragStartY = e.clientY;
    this.hasMoved = false;

    document.addEventListener('pointermove', this.handlePointerMove, true);
    document.addEventListener('pointerup', this.handlePointerUp, true);
    document.addEventListener('pointercancel', this.handlePointerUp, true);
  }

  // Pointer Move: Update ghost and drop slot
  handlePointerMove(e) {
    if (!this.draggedCard) return;

    const deltaX = e.clientX - this.dragStartX;
    const deltaY = e.clientY - this.dragStartY;

    if (!this.hasMoved && Math.hypot(deltaX, deltaY) > 5) {
      this.hasMoved = true;
      this.initGhostAndSlot(e);
    }

    if (this.hasMoved && this.dragGhost) {
      this.dragGhost.style.transform = `translate3d(${e.clientX - this.ghostOffsetX}px, ${e.clientY - this.ghostOffsetY}px, 0) rotate(1.2deg) scale(1.02)`;
      this.updateDropTarget(e.clientX, e.clientY);
    }
  }

  // Initialize the visual ghost and the drop slot
  initGhostAndSlot(e) {
    const rect = this.draggedCard.getBoundingClientRect();
    this.ghostOffsetX = e.clientX - rect.left;
    this.ghostOffsetY = e.clientY - rect.top;

    this.dragGhost = this.draggedCard.cloneNode(true);
    this.dragGhost.className = 'dashmorph-drag-ghost dashmorph-ignore';
    this.dragGhost.style.width = `${rect.width}px`;
    this.dragGhost.style.height = `${rect.height}px`;
    this.dragGhost.style.left = '0px';
    this.dragGhost.style.top = '0px';
    this.dragGhost.style.transform = `translate3d(${rect.left}px, ${rect.top}px, 0) rotate(1.2deg) scale(1.02)`;
    document.body.appendChild(this.dragGhost);

    this.draggedCard.classList.add('dashmorph-card-dragging');

    this.dropSlot = document.createElement('div');
    this.dropSlot.className = 'dashmorph-drop-slot dashmorph-ignore';
    this.dropSlot.innerHTML = `<span class="dashmorph-drop-text">Drop card here</span>`;
    this.dropSlot.style.height = `${Math.min(rect.height, 100)}px`;
    this.dropSlot.style.width = `${rect.width}px`;
  }

  // Find candidate drop target under cursor (supports intra-container and cross-container drops)
  updateDropTarget(clientX, clientY) {
    this.dragGhost.style.display = 'none';
    const elUnder = document.elementFromPoint(clientX, clientY);
    this.dragGhost.style.display = 'block';

    if (!elUnder) return;

    // 1. Hovered over another card
    const candidateCard = elUnder.closest('[data-dashmorph-card="true"]');
    if (candidateCard && candidateCard !== this.draggedCard) {
      const targetContainer = candidateCard.parentElement;
      const rect = candidateCard.getBoundingClientRect();
      const isVertical = rect.height > rect.width || targetContainer.style.flexDirection === 'column';
      
      let isBefore = false;
      if (isVertical) {
        isBefore = clientY < (rect.top + rect.height / 2);
      } else {
        isBefore = clientX < (rect.left + rect.width / 2);
      }

      this.currentDropTarget = candidateCard;
      this.dropPosition = isBefore ? 'before' : 'after';

      if (isBefore) {
        targetContainer.insertBefore(this.dropSlot, candidateCard);
      } else {
        targetContainer.insertBefore(this.dropSlot, candidateCard.nextSibling);
      }
      return;
    }

    // 2. Hovered over a DashMorph container directly
    const targetContainer = elUnder.closest('[data-dashmorph-container="true"]');
    if (targetContainer) {
      this.currentDropTarget = null;
      this.dropPosition = 'end';
      targetContainer.appendChild(this.dropSlot);
    }
  }

  // Pointer Up: Execute DOM reorder and save
  handlePointerUp(e) {
    document.removeEventListener('pointermove', this.handlePointerMove, true);
    document.removeEventListener('pointerup', this.handlePointerUp, true);
    document.removeEventListener('pointercancel', this.handlePointerUp, true);

    if (!this.draggedCard) return;

    if (this.hasMoved && this.dropSlot && this.dropSlot.parentElement) {
      const targetContainer = this.dropSlot.parentElement;

      // Replace drop slot with actual card
      targetContainer.insertBefore(this.draggedCard, this.dropSlot);
      this.dropSlot.remove();

      this.draggedCard.classList.add('dashmorph-drop-pop');
      setTimeout(() => {
        this.draggedCard?.classList.remove('dashmorph-drop-pop');
      }, 400);

      // Auto-save immediately to localStorage & chrome.storage
      this.triggerAutoSave();

      if (window.DashMorphHUDInstance) {
        window.DashMorphHUDInstance.showToast('✨ Layout auto-saved to localStorage!');
      }
    }

    this.cleanupDrag();
  }

  // Clean up drag elements
  cleanupDrag() {
    if (this.dragGhost) {
      this.dragGhost.remove();
      this.dragGhost = null;
    }
    if (this.dropSlot) {
      this.dropSlot.remove();
      this.dropSlot = null;
    }
    if (this.draggedCard) {
      this.draggedCard.classList.remove('dashmorph-card-dragging');
      this.draggedCard = null;
    }
    this.currentDropTarget = null;
    this.hasMoved = false;
  }

  // Trigger layout serialization and save
  async triggerAutoSave() {
    const detector = window.DashMorphDetectorInstance;
    const storage = window.DashMorphStorageInstance;
    if (!detector || !storage) return;

    const containers = detector.detectContainers();
    const layoutData = [];

    containers.forEach(({ element: container, selector }) => {
      const liveCards = Array.from(container.children).filter(child => {
        return !detector.isExcluded(child) && !child.classList.contains('dashmorph-ignore');
      });

      const cardSignatures = liveCards.map((card, idx) => {
        return storage.createCardFingerprint(card, idx);
      }).filter(Boolean);

      layoutData.push({
        containerSelector: selector,
        cards: cardSignatures
      });
    });

    const saved = await storage.saveLayout(layoutData);
    
    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      const totalCards = layoutData.reduce((acc, c) => acc + c.cards.length, 0);
      chrome.runtime.sendMessage({ action: 'UPDATE_BADGE', cardCount: totalCards }).catch(() => {});
    }

    return saved;
  }

  // Apply a saved layout to the live DOM
  applyLayoutOrder(savedContainers) {
    if (!Array.isArray(savedContainers) || savedContainers.length === 0) return 0;
    const storage = window.DashMorphStorageInstance;
    let rearrangedCount = 0;

    // Collect all candidate card elements on the page for cross-container matching
    const allCandidateCards = Array.from(document.querySelectorAll('[data-dashmorph-card="true"], .dash-card, [class*="card"]')).filter(el => {
      return !el.classList.contains('dashmorph-ignore') && el.nodeType === Node.ELEMENT_NODE;
    });

    const assignedGlobalCards = new Set();

    savedContainers.forEach(savedCont => {
      let containerEl = null;
      if (savedCont.containerSelector) {
        try {
          containerEl = document.querySelector(savedCont.containerSelector);
        } catch (e) {}
      }

      if (!containerEl) {
        const allContainers = document.querySelectorAll('main, [role="main"], article, section, div');
        for (const c of allContainers) {
          if (c.children.length >= savedCont.cards.length) {
            containerEl = c;
            break;
          }
        }
      }

      if (!containerEl) return;

      const matchedPairs = [];

      savedCont.cards.forEach(cardSig => {
        let bestScore = -1;
        let bestChild = null;

        // Search within local children first
        const localChildren = Array.from(containerEl.children).filter(c => !assignedGlobalCards.has(c));
        localChildren.forEach(child => {
          const score = storage.scoreElementMatch(cardSig, child);
          if (score > bestScore && score > 0) {
            bestScore = score;
            bestChild = child;
          }
        });

        // If not found locally, search all page candidate cards
        if (!bestChild || bestScore < 100) {
          allCandidateCards.forEach(candidate => {
            if (assignedGlobalCards.has(candidate)) return;
            const score = storage.scoreElementMatch(cardSig, candidate);
            if (score > bestScore && score > 0) {
              bestScore = score;
              bestChild = candidate;
            }
          });
        }

        if (bestChild) {
          assignedGlobalCards.add(bestChild);
          matchedPairs.push({ cardSig, element: bestChild });
        }
      });

      // Apply ordering to container
      if (matchedPairs.length > 0) {
        matchedPairs.forEach(({ cardSig, element }) => {
          if (cardSig.hidden) {
            element.style.display = 'none';
            element.classList.add('dashmorph-hidden');
          } else {
            element.style.display = '';
            element.classList.remove('dashmorph-hidden');
          }
          element.setAttribute('data-dashmorph-card', 'true');
          if (cardSig.id) element.setAttribute('data-dashmorph-id', cardSig.id);

          // Append element in saved sequence
          containerEl.appendChild(element);
          rearrangedCount++;
        });

        containerEl.setAttribute('data-dashmorph-arranged', 'true');
      }
    });

    return rearrangedCount;
  }
}

// Export singleton
window.DashMorphDragEngineInstance = new DashMorphDragEngine();
