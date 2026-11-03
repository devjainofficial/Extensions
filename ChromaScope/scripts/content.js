/**
 * ChromaScope - Precision Pixel & 4-Color Hover Inspector
 * Clean, product-focused in-page color inspection tool.
 * Provides live pixel magnification, exact CIELAB color naming,
 * and complete 4-Color Hover Inspection (Normal BG/Text vs Hover BG/Text).
 */

(() => {
    // Prevent duplicate instances
    if (window.__chromaScopeActive) {
        if (window.__chromaScopeInstance) {
            window.__chromaScopeInstance.destroy();
        }
    }

    class ChromaInspector {
        constructor() {
            this.engine = new ChromaEngine(typeof COLOR_DATABASE !== 'undefined' ? COLOR_DATABASE : null);
            this.isActive = false;
            this.isFrozen = false;
            this.pixelRatio = window.devicePixelRatio || 1;
            
            // Viewport snapshot canvases
            this.viewportCanvas = null;
            this.viewportCtx = null;
            this.hasViewportData = false;

            this.mouseX = window.innerWidth / 2;
            this.mouseY = window.innerHeight / 2;
            this.currentColor = null;

            // 4-Color Hover state tracking
            this.isHoverLocked = false;
            this.hoverMatrixData = null;
            this.liveCaptureTimer = null;
            this.isCapturing = false;
            this.colorParseCtx = null;

            // DOM elements
            this.domRoot = null;
            this.loupeCanvas = null;
            this.loupeCtx = null;

            // Bound handlers
            this.boundOnMouseMove = this.onMouseMove.bind(this);
            this.boundOnClick = this.onClick.bind(this);
            this.boundOnKeyDown = this.onKeyDown.bind(this);
            this.boundOnResize = this.onResize.bind(this);

            this.init();
        }

        init() {
            window.__chromaScopeActive = true;
            window.__chromaScopeInstance = this;

            // Capture initial screen pixels
            this.captureViewport(() => {
                this.buildUI();
                this.bindEvents();
                this.updateInspection(this.mouseX, this.mouseY);
            });
        }

        captureViewport(callback) {
            chrome.runtime.sendMessage({ action: "CAPTURE_TAB" }, (response) => {
                if (response?.dataUrl) {
                    const img = new Image();
                    img.onload = () => {
                        this.viewportCanvas = document.createElement("canvas");
                        this.viewportCanvas.width = img.width;
                        this.viewportCanvas.height = img.height;
                        this.viewportCtx = this.viewportCanvas.getContext("2d", { willReadFrequently: true });
                        this.viewportCtx.drawImage(img, 0, 0);
                        this.hasViewportData = true;
                        if (callback) callback();
                    };
                    img.src = response.dataUrl;
                } else {
                    this.hasViewportData = false;
                    if (callback) callback();
                }
            });
        }

        scheduleLiveCapture() {
            if (this.liveCaptureTimer) clearTimeout(this.liveCaptureTimer);
            this.liveCaptureTimer = setTimeout(() => {
                if (!this.isFrozen && !this.isCapturing) {
                    this.refreshLiveViewport();
                }
            }, 90);
        }

        refreshLiveViewport() {
            this.isCapturing = true;
            chrome.runtime.sendMessage({ action: "CAPTURE_TAB" }, (response) => {
                this.isCapturing = false;
                if (response?.dataUrl && this.viewportCtx) {
                    const img = new Image();
                    img.onload = () => {
                        if (!this.isFrozen && this.viewportCtx) {
                            this.viewportCtx.drawImage(img, 0, 0);
                            this.updateInspection(this.mouseX, this.mouseY);
                        }
                    };
                    img.src = response.dataUrl;
                }
            });
        }

        buildUI() {
            this.domRoot = document.createElement("div");
            this.domRoot.id = "chromascope-inspector-overlay";

            this.domRoot.innerHTML = `
                <!-- Minimal Topbar Banner -->
                <div class="cs-topbar">
                    <div class="cs-topbar-brand">
                        <span class="cs-brand-dot"></span>
                        <span class="cs-brand-title">ChromaScope</span>
                    </div>
                    <div class="cs-topbar-hints">
                        <span class="cs-hint-key">Click</span> Pick
                        <span class="cs-hint-sep">•</span>
                        <span class="cs-hint-key">H</span> 4-Color Lock
                        <span class="cs-hint-sep">•</span>
                        <span class="cs-hint-key">C</span> Copy CSS
                        <span class="cs-hint-sep">•</span>
                        <span class="cs-hint-key">Space</span> Freeze
                        <span class="cs-hint-sep">•</span>
                        <span class="cs-hint-key">Esc</span> Exit
                    </div>
                    <button class="cs-close-btn" title="Close (Esc)">✕</button>
                </div>

                <!-- Floating Assembly: Magnified Loupe + HUD Card -->
                <div class="cs-loupe-assembly" id="cs-loupe-assembly">
                    <div class="cs-loupe-frame">
                        <canvas class="cs-loupe-canvas" width="130" height="130"></canvas>
                        <div class="cs-loupe-reticle">
                            <div class="cs-reticle-crosshair cs-ch-top"></div>
                            <div class="cs-reticle-crosshair cs-ch-bottom"></div>
                            <div class="cs-reticle-crosshair cs-ch-left"></div>
                            <div class="cs-reticle-crosshair cs-ch-right"></div>
                            <div class="cs-reticle-center"></div>
                        </div>
                    </div>

                    <div class="cs-hud-card">
                        <!-- Primary Sampled Pixel -->
                        <div class="cs-hud-header">
                            <div class="cs-hud-swatch" id="cs-hud-swatch"></div>
                            <div class="cs-hud-identity">
                                <div class="cs-hud-name-row">
                                    <span class="cs-hud-color-name" id="cs-hud-name">Analyzing...</span>
                                    <span class="cs-hud-match-pill" id="cs-hud-match">100%</span>
                                </div>
                                <div class="cs-hud-family" id="cs-hud-family">Color Family</div>
                            </div>
                        </div>

                        <!-- Formats Row -->
                        <div class="cs-hud-values">
                            <div class="cs-val-row">
                                <span class="cs-val-lbl">HEX</span>
                                <span class="cs-val-code" id="cs-val-hex">#000000</span>
                            </div>
                            <div class="cs-val-row">
                                <span class="cs-val-lbl">RGB</span>
                                <span class="cs-val-code" id="cs-val-rgb">rgb(0, 0, 0)</span>
                            </div>
                        </div>

                        <!-- 4-Color Hover State Inspector -->
                        <div class="cs-hover-matrix" id="cs-hover-matrix" style="display: none;">
                            <div class="cs-hm-header">
                                <div class="cs-hm-title">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
                                    <span>Hover 4-Color Inspector</span>
                                </div>
                                <span class="cs-hm-lock-badge" id="cs-hm-status">Press H to Lock</span>
                            </div>

                            <div class="cs-hm-columns">
                                <!-- Normal / Resting Column -->
                                <div class="cs-hm-col">
                                    <div class="cs-hm-col-title">Normal (Resting)</div>
                                    
                                    <div class="cs-hm-item" id="cs-hm-norm-bg" title="Click to copy Normal BG HEX">
                                        <span class="cs-hm-item-role">BG</span>
                                        <div class="cs-hm-item-swatch" id="cs-swatch-norm-bg"></div>
                                        <div class="cs-hm-item-info">
                                            <span class="cs-hm-item-hex" id="cs-hex-norm-bg">#EF4444</span>
                                            <span class="cs-hm-item-name" id="cs-name-norm-bg">Red</span>
                                        </div>
                                    </div>

                                    <div class="cs-hm-item" id="cs-hm-norm-text" title="Click to copy Normal Text HEX">
                                        <span class="cs-hm-item-role">Text</span>
                                        <div class="cs-hm-item-swatch" id="cs-swatch-norm-text"></div>
                                        <div class="cs-hm-item-info">
                                            <span class="cs-hm-item-hex" id="cs-hex-norm-text">#FFFFFF</span>
                                            <span class="cs-hm-item-name" id="cs-name-norm-text">White</span>
                                        </div>
                                    </div>
                                </div>

                                <div class="cs-hm-divider">→</div>

                                <!-- Hover / Active Column -->
                                <div class="cs-hm-col">
                                    <div class="cs-hm-col-title">Hover (Active)</div>
                                    
                                    <div class="cs-hm-item" id="cs-hm-hov-bg" title="Click to copy Hover BG HEX">
                                        <span class="cs-hm-item-role">BG</span>
                                        <div class="cs-hm-item-swatch" id="cs-swatch-hov-bg"></div>
                                        <div class="cs-hm-item-info">
                                            <span class="cs-hm-item-hex" id="cs-hex-hov-bg">#4B5563</span>
                                            <span class="cs-hm-item-name" id="cs-name-hov-bg">Gray</span>
                                        </div>
                                    </div>

                                    <div class="cs-hm-item" id="cs-hm-hov-text" title="Click to copy Hover Text HEX">
                                        <span class="cs-hm-item-role">Text</span>
                                        <div class="cs-hm-item-swatch" id="cs-swatch-hov-text"></div>
                                        <div class="cs-hm-item-info">
                                            <span class="cs-hm-item-hex" id="cs-hex-hov-text">#000000</span>
                                            <span class="cs-hm-item-name" id="cs-name-hov-text">Black</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div class="cs-hm-footer">
                                <button class="cs-hm-copy-btn" id="cs-hm-copy-all" title="Copy all 4 colors as CSS rules (Press C)">
                                    📋 Copy All 4 Colors (CSS)
                                </button>
                            </div>
                        </div>

                        <!-- Gradient Detection (compact) -->
                        <div class="cs-gradient-detector" id="cs-gradient-block" style="display: none;">
                            <div class="cs-grad-label">
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 2v20M2 12h20M4.93 4.93l14.14 14.14M4.93 19.07L19.07 4.93"/></svg>
                                <span>CSS Gradient</span>
                            </div>
                            <div class="cs-grad-preview" id="cs-grad-preview"></div>
                            <div class="cs-grad-code" id="cs-grad-code">linear-gradient(...)</div>
                        </div>
                    </div>
                </div>

                <!-- Toast feedback -->
                <div class="cs-toast" id="cs-toast"></div>
            `;

            document.body.appendChild(this.domRoot);

            this.assembly = this.domRoot.querySelector("#cs-loupe-assembly");
            this.loupeCanvas = this.domRoot.querySelector(".cs-loupe-canvas");
            this.loupeCtx = this.loupeCanvas.getContext("2d");
            this.closeBtn = this.domRoot.querySelector(".cs-close-btn");
            this.toast = this.domRoot.querySelector("#cs-toast");

            // 4-Color matrix elements
            this.matrixBlock = this.domRoot.querySelector("#cs-hover-matrix");
            this.matrixStatus = this.domRoot.querySelector("#cs-hm-status");
            this.copyAllBtn = this.domRoot.querySelector("#cs-hm-copy-all");

            this.itemNormBg = this.domRoot.querySelector("#cs-hm-norm-bg");
            this.itemNormText = this.domRoot.querySelector("#cs-hm-norm-text");
            this.itemHovBg = this.domRoot.querySelector("#cs-hm-hov-bg");
            this.itemHovText = this.domRoot.querySelector("#cs-hm-hov-text");

            // Event bindings
            this.closeBtn.addEventListener("click", () => this.destroy());

            this.copyAllBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                this.copyAllFourColorsCSS();
            });

            this.itemNormBg.addEventListener("click", (e) => {
                e.stopPropagation();
                if (this.hoverMatrixData?.normalBg) {
                    navigator.clipboard.writeText(this.hoverMatrixData.normalBg.hex);
                    this.showToast(`Copied Normal BG: ${this.hoverMatrixData.normalBg.hex} (${this.hoverMatrixData.normalBg.colorName})`);
                }
            });

            this.itemNormText.addEventListener("click", (e) => {
                e.stopPropagation();
                if (this.hoverMatrixData?.normalText) {
                    navigator.clipboard.writeText(this.hoverMatrixData.normalText.hex);
                    this.showToast(`Copied Normal Text: ${this.hoverMatrixData.normalText.hex} (${this.hoverMatrixData.normalText.colorName})`);
                }
            });

            this.itemHovBg.addEventListener("click", (e) => {
                e.stopPropagation();
                if (this.hoverMatrixData?.hoverBg) {
                    navigator.clipboard.writeText(this.hoverMatrixData.hoverBg.hex);
                    this.showToast(`Copied Hover BG: ${this.hoverMatrixData.hoverBg.hex} (${this.hoverMatrixData.hoverBg.colorName})`);
                }
            });

            this.itemHovText.addEventListener("click", (e) => {
                e.stopPropagation();
                if (this.hoverMatrixData?.hoverText) {
                    navigator.clipboard.writeText(this.hoverMatrixData.hoverText.hex);
                    this.showToast(`Copied Hover Text: ${this.hoverMatrixData.hoverText.hex} (${this.hoverMatrixData.hoverText.colorName})`);
                }
            });
        }

        bindEvents() {
            window.addEventListener("mousemove", this.boundOnMouseMove, { passive: true });
            window.addEventListener("click", this.boundOnClick, { capture: true });
            window.addEventListener("keydown", this.boundOnKeyDown, { capture: true });
            window.addEventListener("resize", this.boundOnResize);
        }

        unbindEvents() {
            window.removeEventListener("mousemove", this.boundOnMouseMove);
            window.removeEventListener("click", this.boundOnClick, { capture: true });
            window.removeEventListener("keydown", this.boundOnKeyDown, { capture: true });
            window.removeEventListener("resize", this.boundOnResize);
            if (this.liveCaptureTimer) clearTimeout(this.liveCaptureTimer);
        }

        onMouseMove(e) {
            if (this.isFrozen) return;
            this.mouseX = e.clientX;
            this.mouseY = e.clientY;
            this.updateInspection(this.mouseX, this.mouseY);
            this.scheduleLiveCapture();
        }

        onKeyDown(e) {
            if (e.key === "Escape") {
                e.preventDefault();
                e.stopPropagation();
                this.destroy();
                return;
            }

            if (e.key === " ") {
                e.preventDefault();
                e.stopPropagation();
                this.isFrozen = !this.isFrozen;
                this.showToast(this.isFrozen ? "Inspection Frozen (Press Space to resume)" : "Inspection Resumed");
                return;
            }

            if (e.key === "h" || e.key === "H") {
                e.preventDefault();
                e.stopPropagation();
                this.toggleHoverLock();
                return;
            }

            if (e.key === "c" || e.key === "C") {
                e.preventDefault();
                e.stopPropagation();
                if (this.hoverMatrixData) {
                    this.copyAllFourColorsCSS();
                } else if (this.currentColor) {
                    this.copyColorToClipboard(this.currentColor);
                }
                return;
            }

            // Arrow keys for pixel nudging
            const step = e.shiftKey ? 5 : 1;
            let moved = false;
            if (e.key === "ArrowUp") { this.mouseY -= step; moved = true; }
            if (e.key === "ArrowDown") { this.mouseY += step; moved = true; }
            if (e.key === "ArrowLeft") { this.mouseX -= step; moved = true; }
            if (e.key === "ArrowRight") { this.mouseX += step; moved = true; }

            if (moved) {
                e.preventDefault();
                e.stopPropagation();
                this.mouseX = Math.max(0, Math.min(window.innerWidth - 1, this.mouseX));
                this.mouseY = Math.max(0, Math.min(window.innerHeight - 1, this.mouseY));
                this.updateInspection(this.mouseX, this.mouseY);
            }
        }

        onClick(e) {
            if (e.target && (
                e.target.closest(".cs-topbar") ||
                e.target.closest(".cs-close-btn") ||
                e.target.closest(".cs-hm-copy-btn") ||
                e.target.closest(".cs-hm-item")
            )) {
                return;
            }

            e.preventDefault();
            e.stopPropagation();

            if (this.currentColor) {
                this.copyColorToClipboard(this.currentColor);
            }
        }

        onResize() {
            this.pixelRatio = window.devicePixelRatio || 1;
            this.captureViewport(() => {
                this.updateInspection(this.mouseX, this.mouseY);
            });
        }

        /**
         * Core inspection update:
         * 1. Samples live pixel & paints 8x loupe magnification
         * 2. Extracts all 4 colors (Normal BG/Text vs Hover BG/Text)
         */
        updateInspection(clientX, clientY) {
            const physicalX = Math.round(clientX * this.pixelRatio);
            const physicalY = Math.round(clientY * this.pixelRatio);

            const target = document.elementFromPoint(clientX, clientY);

            // Sample pixel color from viewport canvas
            let sampledHex = "#000000";
            const sampleRadius = 6; // 13x13 grid
            const sampleWidth = (sampleRadius * 2) + 1;

            if (this.hasViewportData && this.viewportCtx) {
                const srcX = Math.max(0, Math.min(this.viewportCanvas.width - sampleWidth, physicalX - sampleRadius));
                const srcY = Math.max(0, Math.min(this.viewportCanvas.height - sampleWidth, physicalY - sampleRadius));

                try {
                    const imgData = this.viewportCtx.getImageData(srcX, srcY, sampleWidth, sampleWidth);
                    const centerIdx = (sampleRadius * sampleWidth + sampleRadius) * 4;
                    const r = imgData.data[centerIdx];
                    const g = imgData.data[centerIdx + 1];
                    const b = imgData.data[centerIdx + 2];
                    sampledHex = ChromaEngine.rgbToHex(r, g, b);

                    this.drawLoupePixels(imgData, sampleWidth);
                } catch (err) {
                    console.warn("ChromaScope pixel sample error:", err);
                }
            } else if (target) {
                sampledHex = this.getEffectiveBgColor(target) || "#000000";
            }

            const analysis = this.engine.analyzeColor(sampledHex);
            this.currentColor = analysis;

            // Inspect all 4 colors on hovered element
            this.inspectFourColors(target);

            // Check CSS gradients
            this.detectElementGradients(clientX, clientY, target);

            // Render primary HUD
            this.renderHUD(analysis);

            // Position loupe smoothly near cursor
            this.positionLoupe(clientX, clientY);
        }

        drawLoupePixels(imgData, gridSize) {
            const canvas = this.loupeCanvas;
            const ctx = this.loupeCtx;
            ctx.imageSmoothingEnabled = false;

            const pixelSize = canvas.width / gridSize;
            const center = Math.floor(gridSize / 2);

            for (let y = 0; y < gridSize; y++) {
                for (let x = 0; x < gridSize; x++) {
                    const idx = (y * gridSize + x) * 4;
                    const pr = imgData.data[idx];
                    const pg = imgData.data[idx + 1];
                    const pb = imgData.data[idx + 2];
                    const pa = imgData.data[idx + 3] / 255;

                    ctx.fillStyle = `rgba(${pr}, ${pg}, ${pb}, ${pa})`;
                    ctx.fillRect(x * pixelSize, y * pixelSize, pixelSize, pixelSize);

                    // Subtle grid line
                    ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
                    ctx.strokeRect(x * pixelSize, y * pixelSize, pixelSize, pixelSize);
                }
            }

            // Crisp center reticle square
            ctx.strokeStyle = "#FFFFFF";
            ctx.lineWidth = 1.5;
            ctx.strokeRect(center * pixelSize, center * pixelSize, pixelSize, pixelSize);
            ctx.strokeStyle = "#000000";
            ctx.lineWidth = 1.0;
            ctx.strokeRect(center * pixelSize + 1, center * pixelSize + 1, pixelSize - 2, pixelSize - 2);
        }

        /**
         * 4-COLOR HOVER INSPECTOR:
         * Extracts Normal Background, Normal Text, Hover Background, and Hover Text
         * by inspecting the live element and probing its resting state via an un-hovered clone.
         */
        inspectFourColors(target) {
            if (!this.matrixBlock) return;

            if (this.isHoverLocked) {
                this.matrixBlock.style.display = "block";
                return;
            }

            if (!target || target === document.body || target === document.documentElement) {
                if (!this.isHoverLocked) this.matrixBlock.style.display = "none";
                return;
            }

            // Find closest interactive element or styled container
            let curr = target;
            let interactiveContainer = null;

            while (curr && curr !== document.body && curr !== document.documentElement) {
                const tag = curr.tagName;
                const role = curr.getAttribute ? (curr.getAttribute("role") || "") : "";
                const s = window.getComputedStyle(curr);
                const cursor = s.cursor || "";
                const tr = s.transition || "";

                if (
                    tag === "BUTTON" || tag === "A" || tag === "INPUT" || tag === "SELECT" ||
                    tag === "SUMMARY" || tag === "LI" || tag === "TR" ||
                    role === "button" || role === "menuitem" || role === "tab" || role === "option" ||
                    cursor === "pointer" ||
                    tr.includes("background") || tr.includes("color")
                ) {
                    interactiveContainer = curr;
                    break;
                }
                curr = curr.parentElement;
            }

            const host = interactiveContainer || target;
            const transition = window.getComputedStyle(host).transition || "";

            // 1. Live Hover Colors (currently under mouse pointer)
            const hoverBgHex = this.getEffectiveBgColor(host);
            const hoverTextHex = this.getEffectiveTextColor(target, host);

            // 2. Resting Normal Colors (probed via off-screen un-hovered clone)
            let restingBgHex = hoverBgHex;
            let restingTextHex = hoverTextHex;

            try {
                if (host.parentNode) {
                    const clone = host.cloneNode(true);
                    clone.style.setProperty("position", "absolute", "important");
                    clone.style.setProperty("visibility", "hidden", "important");
                    clone.style.setProperty("pointer-events", "none", "important");
                    clone.style.setProperty("top", "-9999px", "important");
                    clone.style.setProperty("left", "-9999px", "important");
                    clone.style.setProperty("transition", "none", "important");
                    clone.style.setProperty("animation", "none", "important");

                    host.parentNode.insertBefore(clone, host);

                    restingBgHex = this.getEffectiveBgColor(clone) || hoverBgHex;
                    restingTextHex = this.getEffectiveTextColor(clone, clone) || hoverTextHex;

                    clone.remove();
                }
            } catch (e) {
                restingBgHex = hoverBgHex;
                restingTextHex = hoverTextHex;
            }

            // 3. Perceptual Analysis of all 4 Colors
            const normalBg = this.engine.analyzeColor(restingBgHex);
            const normalText = this.engine.analyzeColor(restingTextHex);
            const hoverBg = this.engine.analyzeColor(hoverBgHex);
            const hoverText = this.engine.analyzeColor(hoverTextHex);

            // Determine if hover colors differ or if host is an interactive element
            const bgDiff = ChromaEngine.deltaE(normalBg.lab, hoverBg.lab) >= 1.0;
            const textDiff = ChromaEngine.deltaE(normalText.lab, hoverText.lab) >= 1.0;
            const shouldShow = bgDiff || textDiff || Boolean(interactiveContainer);

            if (shouldShow) {
                this.matrixBlock.style.display = "block";

                // Populate Normal BG
                const swatchNormBg = this.domRoot.querySelector("#cs-swatch-norm-bg");
                const hexNormBg = this.domRoot.querySelector("#cs-hex-norm-bg");
                const nameNormBg = this.domRoot.querySelector("#cs-name-norm-bg");
                swatchNormBg.style.backgroundColor = normalBg.hex;
                hexNormBg.textContent = normalBg.hex;
                nameNormBg.textContent = normalBg.colorName;

                // Populate Normal Text
                const swatchNormText = this.domRoot.querySelector("#cs-swatch-norm-text");
                const hexNormText = this.domRoot.querySelector("#cs-hex-norm-text");
                const nameNormText = this.domRoot.querySelector("#cs-name-norm-text");
                swatchNormText.style.backgroundColor = normalText.hex;
                hexNormText.textContent = normalText.hex;
                nameNormText.textContent = normalText.colorName;

                // Populate Hover BG
                const swatchHovBg = this.domRoot.querySelector("#cs-swatch-hov-bg");
                const hexHovBg = this.domRoot.querySelector("#cs-hex-hov-bg");
                const nameHovBg = this.domRoot.querySelector("#cs-name-hov-bg");
                swatchHovBg.style.backgroundColor = hoverBg.hex;
                hexHovBg.textContent = hoverBg.hex;
                nameHovBg.textContent = hoverBg.colorName;

                // Populate Hover Text
                const swatchHovText = this.domRoot.querySelector("#cs-swatch-hov-text");
                const hexHovText = this.domRoot.querySelector("#cs-hex-hov-text");
                const nameHovText = this.domRoot.querySelector("#cs-name-hov-text");
                swatchHovText.style.backgroundColor = hoverText.hex;
                hexHovText.textContent = hoverText.hex;
                nameHovText.textContent = hoverText.colorName;

                // Cache for locking & export
                const matchTiming = transition.match(/\d+(\.\d+)?(s|ms)/);
                this.hoverMatrixData = {
                    normalBg,
                    normalText,
                    hoverBg,
                    hoverText,
                    hostTag: host.tagName.toLowerCase(),
                    elementId: host.id || "",
                    className: (host.className && typeof host.className === 'string') ? host.className.split(" ")[0] : "",
                    transitionDuration: matchTiming ? matchTiming[0] : "200ms"
                };
            } else if (!this.isHoverLocked) {
                this.matrixBlock.style.display = "none";
                this.hoverMatrixData = null;
            }
        }

        getEffectiveBgColor(el) {
            let curr = el;
            while (curr && curr !== document.documentElement) {
                const s = window.getComputedStyle(curr);
                const parsed = this.parseColorString(s.backgroundColor);
                if (parsed && parsed.a > 0.08) {
                    return ChromaEngine.rgbToHex(parsed.r, parsed.g, parsed.b);
                }
                curr = curr.parentElement;
            }
            return "#FFFFFF";
        }

        getEffectiveTextColor(target, host) {
            if (target) {
                const s = window.getComputedStyle(target);
                const parsed = this.parseColorString(s.color);
                if (parsed && parsed.a > 0.08) {
                    return ChromaEngine.rgbToHex(parsed.r, parsed.g, parsed.b);
                }
            }
            if (host) {
                const s = window.getComputedStyle(host);
                const parsed = this.parseColorString(s.color);
                if (parsed && parsed.a > 0.08) {
                    return ChromaEngine.rgbToHex(parsed.r, parsed.g, parsed.b);
                }
            }
            return "#000000";
        }

        toggleHoverLock() {
            this.isHoverLocked = !this.isHoverLocked;
            const statusEl = this.domRoot.querySelector("#cs-hm-status");

            if (this.isHoverLocked) {
                this.isFrozen = true;
                if (this.matrixBlock) this.matrixBlock.style.display = "block";
                if (statusEl) {
                    statusEl.textContent = "Locked (Press H)";
                    statusEl.style.color = "#34D399";
                }
                this.showToast("Hover Colors Locked! Click any row to copy, or press C for CSS.");
            } else {
                this.isFrozen = false;
                if (statusEl) {
                    statusEl.textContent = "Press H to Lock";
                    statusEl.style.color = "#FBBF24";
                }
                this.showToast("Hover Lock Released.");
            }
        }

        /**
         * Copies clean CSS rule & Tailwind classes containing all 4 inspected colors
         */
        copyAllFourColorsCSS() {
            if (!this.hoverMatrixData) {
                if (this.currentColor) {
                    this.copyColorToClipboard(this.currentColor);
                }
                return;
            }

            const d = this.hoverMatrixData;
            const sel = d.className ? `.${d.className}` : (d.elementId ? `#${d.elementId}` : d.hostTag);

            const cssRule = `/* Generated by ChromaScope */\n/* Normal State */\n${sel} {\n    background-color: ${d.normalBg.hex}; /* ${d.normalBg.colorName} */\n    color: ${d.normalText.hex}; /* ${d.normalText.colorName} */\n    transition: background-color ${d.transitionDuration} ease, color ${d.transitionDuration} ease;\n}\n\n/* Hover State */\n${sel}:hover {\n    background-color: ${d.hoverBg.hex}; /* ${d.hoverBg.colorName} */\n    color: ${d.hoverText.hex}; /* ${d.hoverText.colorName} */\n}\n\n/* Tailwind equivalent: bg-[${d.normalBg.hex}] text-[${d.normalText.hex}] hover:bg-[${d.hoverBg.hex}] hover:text-[${d.hoverText.hex}] */`;

            navigator.clipboard.writeText(cssRule).then(() => {
                this.showToast("Copied all 4 colors as CSS rules!");
            }).catch(() => {
                this.showToast("Saved CSS rules");
            });
        }

        detectElementGradients(clientX, clientY, target) {
            const gradBlock = this.domRoot.querySelector("#cs-gradient-block");
            const gradPreview = this.domRoot.querySelector("#cs-grad-preview");
            const gradCode = this.domRoot.querySelector("#cs-grad-code");

            if (!target) {
                gradBlock.style.display = "none";
                return;
            }

            let curr = target;
            let foundGradient = null;

            while (curr && curr !== document.body && curr !== document.documentElement) {
                const style = window.getComputedStyle(curr);
                const bgImage = style.backgroundImage;
                if (bgImage && (bgImage.includes("linear-gradient") || bgImage.includes("radial-gradient") || bgImage.includes("conic-gradient"))) {
                    foundGradient = bgImage;
                    break;
                }
                curr = curr.parentElement;
            }

            if (foundGradient) {
                gradBlock.style.display = "block";
                gradPreview.style.backgroundImage = foundGradient;
                gradCode.textContent = foundGradient.length > 45 ? foundGradient.substring(0, 43) + "..." : foundGradient;
                gradCode.title = foundGradient;
            } else {
                gradBlock.style.display = "none";
            }
        }

        renderHUD(analysis) {
            const swatch = this.domRoot.querySelector("#cs-hud-swatch");
            const nameEl = this.domRoot.querySelector("#cs-hud-name");
            const matchEl = this.domRoot.querySelector("#cs-hud-match");
            const familyEl = this.domRoot.querySelector("#cs-hud-family");

            const hexEl = this.domRoot.querySelector("#cs-val-hex");
            const rgbEl = this.domRoot.querySelector("#cs-val-rgb");

            // Swatch and Identity
            swatch.style.backgroundColor = analysis.hex;
            nameEl.textContent = analysis.colorName;
            familyEl.textContent = `${analysis.colorFamily} Family`;

            if (analysis.exactMatch) {
                matchEl.textContent = "Exact 100%";
                matchEl.className = "cs-hud-match-pill cs-match-exact";
            } else {
                matchEl.textContent = `${analysis.matchSimilarity}% Match`;
                matchEl.className = "cs-hud-match-pill cs-match-close";
            }

            // Values
            hexEl.textContent = analysis.hex;
            rgbEl.textContent = analysis.rgbString;
        }

        positionLoupe(clientX, clientY) {
            const offset = 24;
            const loupeWidth = 295;
            const loupeHeight = 310;

            let targetX = clientX + offset;
            let targetY = clientY + offset;

            // Screen boundary clamping
            if (targetX + loupeWidth > window.innerWidth) {
                targetX = clientX - loupeWidth - offset;
            }
            if (targetY + loupeHeight > window.innerHeight) {
                targetY = clientY - loupeHeight - offset;
            }

            targetX = Math.max(12, Math.min(window.innerWidth - loupeWidth - 12, targetX));
            targetY = Math.max(50, Math.min(window.innerHeight - loupeHeight - 12, targetY));

            this.assembly.style.transform = `translate3d(${targetX}px, ${targetY}px, 0)`;
        }

        copyColorToClipboard(analysis) {
            chrome.runtime.sendMessage({
                action: "SAVE_COLOR",
                color: analysis
            });

            navigator.clipboard.writeText(analysis.hex).then(() => {
                this.showToast(`Copied ${analysis.hex} (${analysis.colorName}) to clipboard!`);
                this.triggerRipple(this.mouseX, this.mouseY, analysis.hex);
            }).catch(() => {
                this.showToast(`Saved ${analysis.hex} (${analysis.colorName})`);
            });
        }

        triggerRipple(x, y, hex) {
            const ripple = document.createElement("div");
            ripple.className = "cs-click-ripple";
            ripple.style.left = `${x}px`;
            ripple.style.top = `${y}px`;
            ripple.style.borderColor = hex;
            this.domRoot.appendChild(ripple);
            setTimeout(() => ripple.remove(), 500);
        }

        showToast(msg) {
            if (!this.toast) return;
            this.toast.textContent = msg;
            this.toast.classList.add("cs-toast-visible");
            clearTimeout(this.toastTimeout);
            this.toastTimeout = setTimeout(() => {
                this.toast.classList.remove("cs-toast-visible");
            }, 2200);
        }

        parseColorString(colorStr) {
            if (!colorStr || colorStr === "transparent") return { r: 0, g: 0, b: 0, a: 0 };
            
            const m = colorStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
            if (m) {
                return {
                    r: parseInt(m[1]),
                    g: parseInt(m[2]),
                    b: parseInt(m[3]),
                    a: m[4] !== undefined ? parseFloat(m[4]) : 1.0
                };
            }

            if (!this.colorParseCtx) {
                const c = document.createElement("canvas");
                c.width = 1; c.height = 1;
                this.colorParseCtx = c.getContext("2d", { willReadFrequently: true });
            }
            try {
                this.colorParseCtx.fillStyle = "#000000";
                this.colorParseCtx.clearRect(0, 0, 1, 1);
                this.colorParseCtx.fillStyle = colorStr;
                this.colorParseCtx.fillRect(0, 0, 1, 1);
                const p = this.colorParseCtx.getImageData(0, 0, 1, 1).data;
                return { r: p[0], g: p[1], b: p[2], a: p[3] / 255 };
            } catch (e) {
                return { r: 0, g: 0, b: 0, a: 1 };
            }
        }

        destroy() {
            this.unbindEvents();
            if (this.domRoot && this.domRoot.parentNode) {
                this.domRoot.parentNode.removeChild(this.domRoot);
            }
            window.__chromaScopeActive = false;
            window.__chromaScopeInstance = null;
        }
    }

    // Message listener to activate or toggle inspector
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === "ACTIVATE_INSPECTOR") {
            if (!window.__chromaScopeActive) {
                new ChromaInspector();
            }
            sendResponse({ success: true });
        } else if (request.action === "TOGGLE_INSPECTOR") {
            if (!window.__chromaScopeActive) {
                new ChromaInspector();
            } else if (window.__chromaScopeInstance) {
                window.__chromaScopeInstance.destroy();
            }
            sendResponse({ success: true });
        } else if (request.action === "QUICK_EYEDROPPER") {
            if ("EyeDropper" in window) {
                const ed = new window.EyeDropper();
                ed.open().then(result => {
                    if (result?.sRGBHex) {
                        const eng = new ChromaEngine(typeof COLOR_DATABASE !== 'undefined' ? COLOR_DATABASE : null);
                        const analysis = eng.analyzeColor(result.sRGBHex);
                        chrome.runtime.sendMessage({ action: "SAVE_COLOR", color: analysis });
                        navigator.clipboard.writeText(analysis.hex);

                        const t = document.createElement("div");
                        t.id = "cs-quick-eyedropper-toast";
                        t.className = "cs-toast cs-toast-visible";
                        t.style.position = "fixed";
                        t.style.bottom = "24px";
                        t.style.left = "50%";
                        t.style.transform = "translateX(-50%)";
                        t.style.background = "rgba(15, 23, 42, 0.95)";
                        t.style.color = "#F8FAFC";
                        t.style.padding = "10px 20px";
                        t.style.borderRadius = "20px";
                        t.style.border = "1px solid rgba(0, 235, 255, 0.4)";
                        t.style.boxShadow = "0 10px 25px rgba(0,0,0,0.5)";
                        t.style.zIndex = "2147483647";
                        t.style.fontSize = "13px";
                        t.style.fontWeight = "600";
                        t.style.fontFamily = "-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif";
                        t.textContent = `🎯 Copied ${analysis.hex} (${analysis.colorName}) to clipboard!`;
                        document.body.appendChild(t);
                        setTimeout(() => t.remove(), 2500);
                    }
                }).catch(() => {});
            }
            sendResponse({ success: true });
        }
    });

})();
