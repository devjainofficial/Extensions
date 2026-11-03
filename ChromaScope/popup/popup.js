/**
 * ChromaScope - Popup Controller
 * Manages color state, native EyeDropper API, in-page loupe triggers,
 * gradient multi-stop visualizations, harmonies, vision simulation, and dev code generator.
 */

document.addEventListener("DOMContentLoaded", () => {
    // Instantiate Color Engine with the curated database
    const engine = new ChromaEngine(typeof COLOR_DATABASE !== 'undefined' ? COLOR_DATABASE : null);

    // State
    let currentColor = null;
    let historyColors = [];

    // DOM Elements - Actions
    const btnNativePick = document.getElementById("btn-native-pick");
    const btnPageInspect = document.getElementById("btn-page-inspect");
    const btnThemeToggle = document.getElementById("btn-theme-toggle");

    // DOM Elements - Hero
    const heroCard = document.getElementById("cs-hero-card");
    const heroSwatch = document.getElementById("hero-swatch");
    const heroNativeInput = document.getElementById("hero-native-color-input");
    const heroName = document.getElementById("hero-name");
    const heroMatch = document.getElementById("hero-match");
    const heroFamily = document.getElementById("hero-family");
    const heroHexBar = document.getElementById("hero-hex-bar");
    const heroHex = document.getElementById("hero-hex");
    const btnCopyHex = document.getElementById("btn-copy-hex");
    const btnPlayTone = document.getElementById("btn-play-tone");
    const toneFreqLabel = document.getElementById("tone-freq-label");

    // DOM Elements - Chips
    const chipRgb = document.getElementById("chip-rgb");
    const valRgb = document.getElementById("val-rgb");
    const chipHsl = document.getElementById("chip-hsl");
    const valHsl = document.getElementById("val-hsl");
    const chipLab = document.getElementById("chip-lab");
    const valLab = document.getElementById("val-lab");

    // DOM Elements - Tabs
    const tabBtns = document.querySelectorAll(".cs-tab-btn");
    const tabPanels = document.querySelectorAll(".cs-tab-panel");

    // DOM Elements - Nuance Tab
    const nuanceTone = document.getElementById("nuance-tone");
    const nuanceTemp = document.getElementById("nuance-temp");
    const nuanceSat = document.getElementById("nuance-sat");
    const nuanceLum = document.getElementById("nuance-lum");
    const nuanceNarrative = document.getElementById("nuance-narrative");
    const gradientBarPreview = document.getElementById("gradient-bar-preview");
    const gradientStopsList = document.getElementById("gradient-stops-list");
    const btnCopyCssGrad = document.getElementById("btn-copy-css-grad");
    const psychArchetype = document.getElementById("psych-archetype");
    const psychResonance = document.getElementById("psych-resonance");
    const psychDesc = document.getElementById("psych-desc");
    const psychUsage = document.getElementById("psych-usage");

    // DOM Elements - Harmonies Tab
    const harmoniesGrid = document.getElementById("harmonies-grid");
    const tonalScaleStrip = document.getElementById("tonal-scale-strip");

    // DOM Elements - Vision & A11y Tab
    const boxOnWhite = document.getElementById("box-on-white");
    const ratioWhite = document.getElementById("ratio-white");
    const badgesWhite = document.getElementById("badges-white");
    const boxOnBlack = document.getElementById("box-on-black");
    const ratioBlack = document.getElementById("ratio-black");
    const badgesBlack = document.getElementById("badges-black");
    const recTextColor = document.getElementById("rec-text-color");
    const blindnessGrid = document.getElementById("blindness-grid");

    // DOM Elements - Dev & Code Tab
    const twTokenPill = document.getElementById("tw-token-pill");
    const twBgRow = document.getElementById("tw-bg-row");
    const twBgClass = document.getElementById("tw-bg-class");
    const twTextRow = document.getElementById("tw-text-row");
    const twTextClass = document.getElementById("tw-text-class");
    const twArbRow = document.getElementById("tw-arb-row");
    const twArbVal = document.getElementById("tw-arb-val");
    const codeCssVar = document.getElementById("code-css-var");
    const codeCssVal = document.getElementById("code-css-val");
    const codeSwift = document.getElementById("code-swift");
    const codeSwiftVal = document.getElementById("code-swift-val");
    const codeFlutter = document.getElementById("code-flutter");
    const codeFlutterVal = document.getElementById("code-flutter-val");

    // DOM Elements - History Tab
    const historyList = document.getElementById("history-list");
    const btnClearHistory = document.getElementById("btn-clear-history");
    const btnExportCss = document.getElementById("btn-export-css");
    const btnExportJson = document.getElementById("btn-export-json");
    const btnExportTxt = document.getElementById("btn-export-txt");

    // Toast
    const popupToast = document.getElementById("popup-toast");

    /* -----------------------------
       Theme Initialization
    ----------------------------- */
    const savedTheme = localStorage.getItem("cs-theme") || "dark";
    document.body.setAttribute("data-theme", savedTheme);

    btnThemeToggle.addEventListener("click", () => {
        const current = document.body.getAttribute("data-theme") || "dark";
        const next = current === "dark" ? "light" : "dark";
        document.body.setAttribute("data-theme", next);
        localStorage.setItem("cs-theme", next);
    });

    /* -----------------------------
       Tab Switching
    ----------------------------- */
    tabBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            tabBtns.forEach(b => b.classList.remove("active"));
            tabPanels.forEach(p => p.classList.remove("active"));

            btn.classList.add("active");
            const targetId = btn.getAttribute("data-tab");
            document.getElementById(targetId)?.classList.add("active");
        });
    });

    /* -----------------------------
       Color Inspection & Update
    ----------------------------- */
    function setInspectedColor(hex) {
        const analysis = engine.analyzeColor(hex);
        currentColor = analysis;

        // 1. Update Hero
        heroSwatch.style.backgroundColor = analysis.hex;
        heroNativeInput.value = analysis.hex;
        heroName.textContent = analysis.colorName;
        heroFamily.textContent = `${analysis.colorFamily} Family`;
        heroHex.textContent = analysis.hex;

        if (toneFreqLabel) {
            toneFreqLabel.textContent = `${analysis.audioFrequency} Hz`;
        }

        if (analysis.exactMatch) {
            heroMatch.textContent = "Exact 100%";
            heroMatch.className = "cs-hero-match-pill cs-match-exact";
        } else {
            heroMatch.textContent = `${analysis.matchSimilarity}% Match`;
            heroMatch.className = "cs-hero-match-pill cs-match-close";
            heroMatch.title = `Perceptual CIE Delta-E Distance: ${analysis.matchDistance}`;
        }

        // 2. Update Formats
        valRgb.textContent = analysis.rgbString;
        valHsl.textContent = analysis.hslString;
        valLab.textContent = `lab(${analysis.lab.L}% ${analysis.lab.a} ${analysis.lab.b})`;

        // 3. Update Nuance & Gradient Profile
        const g = analysis.gradientNuance;
        nuanceTone.textContent = g.toneCategory;
        nuanceTemp.textContent = g.temperature;
        nuanceSat.textContent = g.saturationClass;
        nuanceLum.textContent = `${g.luminance}%`;

        nuanceNarrative.textContent = `${analysis.nuanceDescription}. Positioned in gradient spectrum as ${g.toneCategory.toLowerCase()} with ${g.temperature.toLowerCase()} undertones. ${g.toneDetail}.`;

        // 4. Update Psychology
        renderPsychology(analysis);

        // 5. Update Multi-stop Gradient Transition
        renderGradientStops(analysis);

        // 6. Update Harmonies & Tonal Scales
        renderHarmonies(analysis);

        // 7. Update Accessibility & Color Blindness
        renderAccessibility(analysis);
        renderBlindness(analysis);

        // 8. Update Developer Tokens
        renderDevCode(analysis);

        // 9. Save to local history
        saveToHistory(analysis);
    }

    /* -----------------------------
       Psychology Rendering
    ----------------------------- */
    function renderPsychology(analysis) {
        if (!psychArchetype) return;
        const p = analysis.psychology;
        psychArchetype.textContent = p.archetype;
        psychResonance.textContent = p.resonance;
        psychDesc.textContent = p.psychology;
        psychUsage.textContent = `Usage: ${p.recommendedUsage}`;
    }

    /* -----------------------------
       Gradient Multi-stop Rendering
    ----------------------------- */
    let currentGradientCSS = "";

    function renderGradientStops(analysis) {
        const comp = analysis.harmonies.complementary.hex;
        const interp = engine.interpolateGradient(analysis.hex, comp, 5);
        currentGradientCSS = interp.cssLinear;

        gradientBarPreview.style.backgroundImage = interp.cssLinear;
        gradientStopsList.innerHTML = "";

        interp.stops.forEach(stop => {
            const row = document.createElement("div");
            row.className = "cs-stop-row";
            row.innerHTML = `
                <div class="cs-stop-left">
                    <div class="cs-stop-swatch" style="background-color: ${stop.hex};"></div>
                    <span class="cs-stop-name">${stop.name}</span>
                    <span class="cs-stop-hex">${stop.hex}</span>
                </div>
                <span class="cs-stop-pos">${stop.stopPercent}%</span>
            `;
            row.addEventListener("click", () => {
                setInspectedColor(stop.hex);
                showToast(`Inspecting stop ${stop.hex} (${stop.name})`);
            });
            gradientStopsList.appendChild(row);
        });
    }

    /* -----------------------------
       Harmonies Rendering
    ----------------------------- */
    function renderHarmonies(analysis) {
        harmoniesGrid.innerHTML = "";
        const h = analysis.harmonies;

        const harmonyItems = [
            { type: "Complementary", color: h.complementary },
            { type: "Analogous (+30°)", color: h.analogous[1] },
            { type: "Analogous (-30°)", color: h.analogous[0] },
            { type: "Triadic Pair", color: h.triadic[0] }
        ];

        harmonyItems.forEach(item => {
            const card = document.createElement("div");
            card.className = "cs-harmony-card";
            card.innerHTML = `
                <div class="cs-harmony-swatch" style="background-color: ${item.color.hex};"></div>
                <div class="cs-harmony-meta">
                    <span class="cs-harmony-type">${item.type}</span>
                    <span class="cs-harmony-name">${item.color.name}</span>
                    <span class="cs-harmony-hex">${item.color.hex}</span>
                </div>
            `;
            card.addEventListener("click", () => {
                setInspectedColor(item.color.hex);
                showToast(`Selected ${item.color.hex} (${item.color.name})`);
            });
            harmoniesGrid.appendChild(card);
        });

        // 7-Step Tonal Scale
        tonalScaleStrip.innerHTML = "";
        h.tonalScale.forEach(step => {
            const stepEl = document.createElement("div");
            stepEl.className = `cs-tonal-step ${step.isCurrent ? 'current' : ''}`;
            stepEl.style.backgroundColor = step.hex;
            stepEl.title = `${step.name} (${step.hex}) - Lightness ${step.lightness}%`;

            const textDark = step.lightness > 55;
            stepEl.innerHTML = `<span class="cs-tonal-step-lbl" style="color: ${textDark ? '#000' : '#FFF'};">${step.lightness}%</span>`;

            stepEl.addEventListener("click", () => {
                setInspectedColor(step.hex);
                showToast(`Selected ${step.hex} (${step.name})`);
            });
            tonalScaleStrip.appendChild(stepEl);
        });
    }

    /* -----------------------------
       Accessibility & Vision Simulation
    ----------------------------- */
    function renderAccessibility(analysis) {
        const a11y = analysis.accessibility;

        boxOnWhite.style.color = analysis.hex;
        ratioWhite.textContent = `${a11y.contrastOnWhite}:1`;
        badgesWhite.innerHTML = `
            <span class="cs-badge ${a11y.aaNormalWhite ? 'cs-pass' : 'cs-fail'}">AA Normal</span>
            <span class="cs-badge ${a11y.aaaNormalWhite ? 'cs-pass' : 'cs-fail'}">AAA</span>
        `;

        boxOnBlack.style.color = analysis.hex;
        ratioBlack.textContent = `${a11y.contrastOnBlack}:1`;
        badgesBlack.innerHTML = `
            <span class="cs-badge ${a11y.aaNormalBlack ? 'cs-pass' : 'cs-fail'}">AA Normal</span>
            <span class="cs-badge ${a11y.aaaNormalBlack ? 'cs-pass' : 'cs-fail'}">AAA</span>
        `;

        recTextColor.textContent = a11y.recommendedText === "#FFFFFF" ? "White (#FFFFFF)" : "Black (#000000)";
        recTextColor.style.color = a11y.recommendedText;
    }

    function renderBlindness(analysis) {
        if (!blindnessGrid) return;
        blindnessGrid.innerHTML = "";
        const cb = analysis.colorBlindness;

        const entries = [cb.protanopia, cb.deuteranopia, cb.tritanopia, cb.achromatopsia];
        entries.forEach(item => {
            const card = document.createElement("div");
            card.className = "cs-blindness-card";
            card.innerHTML = `
                <span class="cs-blindness-type">${item.type}</span>
                <div class="cs-blindness-swatch-row">
                    <div class="cs-blindness-swatch" style="background-color: ${item.hex};"></div>
                    <span class="cs-blindness-hex">${item.hex}</span>
                </div>
                <span class="cs-blindness-name">${item.name}</span>
            `;
            card.addEventListener("click", () => {
                setInspectedColor(item.hex);
                showToast(`Inspecting simulated ${item.hex} (${item.name})`);
            });
            blindnessGrid.appendChild(card);
        });
    }

    /* -----------------------------
       Developer Code Generator
    ----------------------------- */
    function renderDevCode(analysis) {
        const tw = analysis.tailwind;
        if (twTokenPill) twTokenPill.textContent = tw.nearestToken;
        if (twBgClass) twBgClass.textContent = tw.bgClass;
        if (twTextClass) twTextClass.textContent = tw.textClass;
        if (twArbVal) twArbVal.textContent = tw.arbitraryBg;

        const cleanVarName = analysis.colorName.toLowerCase().replace(/[^a-z0-9]/g, "-");
        if (codeCssVal) codeCssVal.textContent = `--color-${cleanVarName}: ${analysis.hex};`;

        const rNorm = (analysis.rgb.r / 255).toFixed(2);
        const gNorm = (analysis.rgb.g / 255).toFixed(2);
        const bNorm = (analysis.rgb.b / 255).toFixed(2);
        if (codeSwiftVal) codeSwiftVal.textContent = `Color(red: ${rNorm}, green: ${gNorm}, blue: ${bNorm})`;
        if (codeFlutterVal) codeFlutterVal.textContent = `Color(0xFF${analysis.hexRaw})`;
    }

    // Dev Code Copy Click Handlers
    twBgRow?.addEventListener("click", () => copyText(twBgClass.textContent, `Copied ${twBgClass.textContent}!`));
    twTextRow?.addEventListener("click", () => copyText(twTextClass.textContent, `Copied ${twTextClass.textContent}!`));
    twArbRow?.addEventListener("click", () => copyText(twArbVal.textContent, `Copied ${twArbVal.textContent}!`));
    codeCssVar?.addEventListener("click", () => copyText(codeCssVal.textContent, "Copied CSS Variable!"));
    codeSwift?.addEventListener("click", () => copyText(codeSwiftVal.textContent, "Copied SwiftUI Color!"));
    codeFlutter?.addEventListener("click", () => copyText(codeFlutterVal.textContent, "Copied Flutter Color!"));

    /* -----------------------------
       Chromesthesia Tone Synthesizer Player
    ----------------------------- */
    btnPlayTone?.addEventListener("click", () => {
        if (currentColor) {
            ChromaEngine.playColorTone(currentColor.hex, 1.2);
            showToast(`Playing ${currentColor.audioFrequency} Hz harmonic tone for ${currentColor.colorName}`);
        }
    });

    /* -----------------------------
       History & Storage
    ----------------------------- */
    function loadHistory() {
        chrome.storage.local.get(["chromaHistory"], (res) => {
            historyColors = res.chromaHistory || [];
            renderHistoryUI();
        });
    }

    function saveToHistory(colorObj) {
        chrome.storage.local.get(["chromaHistory"], (res) => {
            let hist = res.chromaHistory || [];
            hist = hist.filter(c => c.hex.toUpperCase() !== colorObj.hex.toUpperCase());
            hist.unshift({
                hex: colorObj.hex,
                name: colorObj.colorName,
                family: colorObj.colorFamily,
                timestamp: Date.now()
            });
            if (hist.length > 50) hist.pop();
            chrome.storage.local.set({ chromaHistory: hist }, () => {
                historyColors = hist;
                renderHistoryUI();
            });
        });
    }

    function renderHistoryUI() {
        if (!historyList) return;
        historyList.innerHTML = "";

        if (historyColors.length === 0) {
            historyList.innerHTML = `<div class="cs-empty-state">No colors inspected yet. Pick any pixel on screen to build your palette!</div>`;
            return;
        }

        historyColors.forEach(item => {
            const row = document.createElement("div");
            row.className = "cs-history-row";
            row.innerHTML = `
                <div class="cs-history-left">
                    <div class="cs-history-swatch" style="background-color: ${item.hex};"></div>
                    <span class="cs-history-name">${item.name}</span>
                </div>
                <span class="cs-history-hex">${item.hex}</span>
            `;
            row.addEventListener("click", () => {
                setInspectedColor(item.hex);
                showToast(`Loaded ${item.hex} (${item.name})`);
            });
            historyList.appendChild(row);
        });
    }

    btnClearHistory.addEventListener("click", () => {
        chrome.storage.local.set({ chromaHistory: [] }, () => {
            historyColors = [];
            renderHistoryUI();
            showToast("History cleared");
        });
    });

    /* -----------------------------
       Palette Export Functions
    ----------------------------- */
    btnExportCss.addEventListener("click", () => {
        if (historyColors.length === 0) return showToast("Palette is empty");
        let css = ":root {\n";
        historyColors.forEach((c) => {
            const cleanName = c.name.toLowerCase().replace(/[^a-z0-9]/g, "-");
            css += `  --color-${cleanName}: ${c.hex}; /* ${c.family} */\n`;
        });
        css += "}\n";
        copyText(css, "Copied CSS Variables to clipboard!");
    });

    btnExportJson.addEventListener("click", () => {
        if (historyColors.length === 0) return showToast("Palette is empty");
        const json = JSON.stringify(historyColors, null, 2);
        copyText(json, "Copied JSON palette to clipboard!");
    });

    btnExportTxt.addEventListener("click", () => {
        if (historyColors.length === 0) return showToast("Palette is empty");
        const txt = historyColors.map(c => `${c.hex} - ${c.name} (${c.family})`).join("\n");
        copyText(txt, "Copied color list to clipboard!");
    });

    /* -----------------------------
       Native EyeDropper API
    ----------------------------- */
    btnNativePick.addEventListener("click", async () => {
        if ("EyeDropper" in window) {
            try {
                const eyeDropper = new window.EyeDropper();
                const result = await eyeDropper.open();
                if (result?.sRGBHex) {
                    setInspectedColor(result.sRGBHex);
                    ChromaEngine.playColorTone(result.sRGBHex, 0.4);
                    showToast(`Sampled ${result.sRGBHex}`);
                }
            } catch (err) {
                // User dismissed with Escape
                console.log("EyeDropper closed:", err);
            }
        } else {
            // Fallback to in-page inspector
            triggerPageInspector();
        }
    });

    /* -----------------------------
       In-Page Loupe Inspector Trigger
    ----------------------------- */
    function triggerPageInspector() {
        chrome.runtime.sendMessage({ action: "START_INSPECTOR_FROM_POPUP" }, () => {
            // Close popup so user can freely click and inspect page elements
            window.close();
        });
    }

    btnPageInspect.addEventListener("click", () => {
        triggerPageInspector();
    });

    /* -----------------------------
       Copy Handlers
    ----------------------------- */
    heroHexBar.addEventListener("click", () => {
        if (currentColor) copyText(currentColor.hex, `Copied ${currentColor.hex} (${currentColor.colorName})`);
    });

    chipRgb.addEventListener("click", () => {
        if (currentColor) copyText(currentColor.rgbString, `Copied ${currentColor.rgbString}`);
    });

    chipHsl.addEventListener("click", () => {
        if (currentColor) copyText(currentColor.hslString, `Copied ${currentColor.hslString}`);
    });

    chipLab.addEventListener("click", () => {
        if (currentColor) copyText(currentColor.labString, `Copied ${currentColor.labString}`);
    });

    btnCopyCssGrad.addEventListener("click", () => {
        if (currentGradientCSS) copyText(`background-image: ${currentGradientCSS};`, "Copied CSS gradient code!");
    });

    heroNativeInput.addEventListener("input", (e) => {
        setInspectedColor(e.target.value);
    });

    function copyText(text, msg) {
        navigator.clipboard.writeText(text).then(() => {
            showToast(msg);
        });
    }

    let toastTimer = null;
    function showToast(msg) {
        if (!popupToast) return;
        popupToast.textContent = msg;
        popupToast.classList.add("visible");
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => {
            popupToast.classList.remove("visible");
        }, 2200);
    }

    /* -----------------------------
       Initialize Initial View
    ----------------------------- */
    chrome.storage.local.get(["chromaHistory"], (res) => {
        const hist = res.chromaHistory || [];
        historyColors = hist;
        renderHistoryUI();

        if (hist.length > 0) {
            setInspectedColor(hist[0].hex);
        } else {
            // Default vibrant brand color: #4F46E5 ("Indigo")
            setInspectedColor("#4F46E5");
        }
    });
});
