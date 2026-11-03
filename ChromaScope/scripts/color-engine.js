/**
 * ChromaScope - Advanced Color Analysis & Perceptual Naming Engine
 * 
 * Implements:
 * - Color conversions: HEX, RGB, HSL, HSV, CMYK, CIE-XYZ, CIELAB
 * - CIELAB Delta-E (CIE76) perceptual color distance matching
 * - Gradient & Shade Nuance Analysis (Luminance, Temperature, Undertone, Tonal Classification)
 * - Multi-stop Gradient Interpolation & Harmony Generation
 * - WCAG 2.1 Contrast & Accessibility Metrics
 */

class ChromaEngine {
    constructor(database = null) {
        // If COLOR_DATABASE is available in global scope, use it
        if (database) {
            this.db = database;
        } else if (typeof COLOR_DATABASE !== 'undefined') {
            this.db = COLOR_DATABASE;
        } else {
            this.db = [];
        }
    }

    setDatabase(db) {
        this.db = db;
    }

    /* -----------------------------
       Basic Conversions
    ----------------------------- */

    static cleanHex(hex) {
        if (!hex) return '000000';
        hex = hex.replace(/^#/, '').trim().toUpperCase();
        if (hex.length === 3) {
            hex = hex.split('').map(c => c + c).join('');
        }
        if (hex.length !== 6) {
            hex = hex.padEnd(6, '0').slice(0, 6);
        }
        return hex;
    }

    static hexToRgb(hex) {
        const clean = ChromaEngine.cleanHex(hex);
        return {
            r: parseInt(clean.substring(0, 2), 16) || 0,
            g: parseInt(clean.substring(2, 4), 16) || 0,
            b: parseInt(clean.substring(4, 6), 16) || 0
        };
    }

    static rgbToHex(r, g, b) {
        const toHex = (n) => {
            const clamped = Math.max(0, Math.min(255, Math.round(n)));
            return clamped.toString(16).padStart(2, '0').toUpperCase();
        };
        return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    }

    static rgbToHsl(r, g, b) {
        const rNorm = r / 255;
        const gNorm = g / 255;
        const bNorm = b / 255;

        const max = Math.max(rNorm, gNorm, bNorm);
        const min = Math.min(rNorm, gNorm, bNorm);
        const delta = max - min;

        let h = 0;
        let s = 0;
        const l = (max + min) / 2;

        if (delta !== 0) {
            s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min);
            switch (max) {
                case rNorm:
                    h = ((gNorm - bNorm) / delta + (gNorm < bNorm ? 6 : 0));
                    break;
                case gNorm:
                    h = ((bNorm - rNorm) / delta + 2);
                    break;
                case bNorm:
                    h = ((rNorm - gNorm) / delta + 4);
                    break;
            }
            h *= 60;
        }

        return {
            h: Math.round(h),
            s: Math.round(s * 100),
            l: Math.round(l * 100)
        };
    }

    static hslToRgb(h, s, l) {
        h = ((h % 360) + 360) % 360 / 360;
        s = Math.max(0, Math.min(100, s)) / 100;
        l = Math.max(0, Math.min(100, l)) / 100;

        if (s === 0) {
            const val = Math.round(l * 255);
            return { r: val, g: val, b: val };
        }

        const hue2rgb = (p, q, t) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1/6) return p + (q - p) * 6 * t;
            if (t < 1/2) return q;
            if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
            return p;
        };

        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;

        return {
            r: Math.round(hue2rgb(p, q, h + 1/3) * 255),
            g: Math.round(hue2rgb(p, q, h) * 255),
            b: Math.round(hue2rgb(p, q, h - 1/3) * 255)
        };
    }

    static rgbToHsv(r, g, b) {
        const rNorm = r / 255;
        const gNorm = g / 255;
        const bNorm = b / 255;

        const max = Math.max(rNorm, gNorm, bNorm);
        const min = Math.min(rNorm, gNorm, bNorm);
        const delta = max - min;

        let h = 0;
        const s = max === 0 ? 0 : delta / max;
        const v = max;

        if (delta !== 0) {
            switch (max) {
                case rNorm: h = (gNorm - bNorm) / delta + (gNorm < bNorm ? 6 : 0); break;
                case gNorm: h = (bNorm - rNorm) / delta + 2; break;
                case bNorm: h = (rNorm - gNorm) / delta + 4; break;
            }
            h *= 60;
        }

        return {
            h: Math.round(h),
            s: Math.round(s * 100),
            v: Math.round(v * 100)
        };
    }

    static rgbToCmyk(r, g, b) {
        const rNorm = r / 255;
        const gNorm = g / 255;
        const bNorm = b / 255;

        const k = 1 - Math.max(rNorm, gNorm, bNorm);
        if (k === 1) {
            return { c: 0, m: 0, y: 0, k: 100 };
        }

        const c = (1 - rNorm - k) / (1 - k);
        const m = (1 - gNorm - k) / (1 - k);
        const y = (1 - bNorm - k) / (1 - k);

        return {
            c: Math.round(c * 100),
            m: Math.round(m * 100),
            y: Math.round(y * 100),
            k: Math.round(k * 100)
        };
    }

    /* -----------------------------
       Perceptual CIELAB (D65)
    ----------------------------- */

    static rgbToLab(r, g, b) {
        // sRGB to Linear RGB
        const pivotRgb = (c) => {
            const val = c / 255.0;
            return val <= 0.04045 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4);
        };

        const lr = pivotRgb(r);
        const lg = pivotRgb(g);
        const lb = pivotRgb(b);

        // Linear RGB to XYZ (D65 illuminant standard observer)
        const x = (lr * 0.4124564 + lg * 0.3575761 + lb * 0.1804375) / 0.95047;
        const y = (lr * 0.2126729 + lg * 0.7151522 + lb * 0.0721750) / 1.00000;
        const z = (lr * 0.0193339 + lg * 0.1191920 + lb * 0.9503041) / 1.08883;

        // XYZ to Lab
        const pivotXyz = (c) => {
            return c > 0.008856 ? Math.cbrt(c) : (7.787 * c) + (16 / 116);
        };

        const fx = pivotXyz(x);
        const fy = pivotXyz(y);
        const fz = pivotXyz(z);

        const L = (116 * fy) - 16;
        const a = 500 * (fx - fy);
        const bVal = 200 * (fy - fz);

        return {
            L: parseFloat(L.toFixed(2)),
            a: parseFloat(a.toFixed(2)),
            b: parseFloat(bVal.toFixed(2))
        };
    }

    /**
     * Compute Delta-E (CIE76) Euclidean distance in L*a*b* space.
     * Perceptual reference:
     * - DeltaE < 1.0: Imperceptible difference
     * - DeltaE < 2.0: Perceptible only through close observation
     * - DeltaE < 10.0: Close variation / shade
     * - DeltaE > 49.0: Colors are more different than similar
     */
    static deltaE(lab1, lab2) {
        const dL = lab1.L - lab2.L;
        const da = lab1.a - lab2.a;
        const db = lab1.b - lab2.b;
        return Math.sqrt(dL * dL + da * da + db * db);
    }

    /* -----------------------------
       Color Naming Algorithm
    ----------------------------- */

    /**
     * Finds exact or perceptually nearest named color from database
     */
    findNearestColor(hex) {
        const clean = ChromaEngine.cleanHex(hex);
        const rgb = ChromaEngine.hexToRgb(clean);
        const lab = ChromaEngine.rgbToLab(rgb.r, rgb.g, rgb.b);

        if (!this.db || this.db.length === 0) {
            return {
                name: `#${clean}`,
                hex: clean,
                family: 'Unknown',
                distance: 0,
                exactMatch: true,
                similarity: 100,
                description: 'Custom Color'
            };
        }

        let bestMatch = null;
        let minDistance = Infinity;

        for (let i = 0; i < this.db.length; i++) {
            const entry = this.db[i];
            const [entryHex, entryName, entryL, entryA, entryB, entryFamily] = entry;

            // Instant exact match check
            if (entryHex.toUpperCase() === clean) {
                return {
                    name: entryName,
                    hex: entryHex,
                    family: entryFamily,
                    distance: 0,
                    exactMatch: true,
                    similarity: 100,
                    description: `Exact standard match for ${entryName}`
                };
            }

            const dist = ChromaEngine.deltaE(lab, { L: entryL, a: entryA, b: entryB });
            if (dist < minDistance) {
                minDistance = dist;
                bestMatch = entry;
                if (dist === 0) break;
            }
        }

        const [mHex, mName, mL, mA, mB, mFamily] = bestMatch;
        const exact = minDistance < 0.5;
        
        // Calculate similarity percentage (100% at dist=0, ~80% at dist=20)
        const similarity = Math.max(0, Math.min(100, Math.round(100 - (minDistance * 1.6))));

        // Generate nuance description based on lightness & chromatic shift
        const dL = lab.L - mL;
        let nuance = '';
        if (Math.abs(dL) < 3 && minDistance < 4) {
            nuance = `Nearly identical to ${mName}`;
        } else if (dL > 8) {
            nuance = `Lighter, luminous tint of ${mName}`;
        } else if (dL < -8) {
            nuance = `Deeper, richer shade of ${mName}`;
        } else {
            nuance = `Close nuance of ${mName}`;
        }

        return {
            name: mName,
            hex: mHex,
            family: mFamily,
            distance: parseFloat(minDistance.toFixed(2)),
            exactMatch: exact,
            similarity: similarity,
            description: nuance
        };
    }

    /* -----------------------------
       Gradient & Nuance Intelligence
    ----------------------------- */

    /**
     * Detailed breakdown of a color's position in tonal/gradient space:
     * - Tonal shade classification (Tint, Pure, Tone, Shade, Shadow)
     * - Temperature (Warm, Cool, Neutral)
     * - Saturation intensity (Muted, Pastel, Vivid, Electric)
     * - Undertone and perceptual presence
     */
    analyzeGradientNuance(hex) {
        const rgb = ChromaEngine.hexToRgb(hex);
        const hsl = ChromaEngine.rgbToHsl(rgb.r, rgb.g, rgb.b);
        const lab = ChromaEngine.rgbToLab(rgb.r, rgb.g, rgb.b);

        // 1. Tonal Classification
        let toneCategory = 'Mid-tone';
        let toneDetail = 'Balanced mid-spectrum tone';
        if (lab.L >= 96) {
            toneCategory = 'Pure Highlight / Tint';
            toneDetail = 'Near-white highlight, ideal for specular reflections or glow apexes';
        } else if (lab.L >= 82) {
            toneCategory = 'High Tint / Pastel';
            toneDetail = 'Soft, luminous pastel tone, often seen at the bright end of soft gradients';
        } else if (lab.L >= 62) {
            toneCategory = 'Light Mid-tone';
            toneDetail = 'Bright open tone, excellent transition bridge between tint and primary hue';
        } else if (lab.L >= 38) {
            toneCategory = 'Core Vibrant Tone';
            toneDetail = 'Rich body color carrying the highest saturation density in gradients';
        } else if (lab.L >= 20) {
            toneCategory = 'Deep Shade';
            toneDetail = 'Velvety deep shade, provides weight and depth in multi-stop gradients';
        } else {
            toneCategory = 'Shadow / Midnight';
            toneDetail = 'Umbra shadow tone, grounds gradients with high contrast';
        }

        // 2. Temperature & Undertone
        let temperature = 'Neutral';
        let tempDetail = 'Equally balanced between warm and cool wavelengths';
        if (hsl.s <= 10) {
            temperature = 'Neutral Achromatic';
            tempDetail = 'Pure neutral without dominant color bias';
        } else if (hsl.h >= 25 && hsl.h <= 70) {
            temperature = 'Warm Golden';
            tempDetail = 'Warm undertones with yellow-gold spectral radiance';
        } else if (hsl.h > 70 && hsl.h <= 165) {
            temperature = 'Cool Green / Fresh';
            tempDetail = 'Refreshing crisp balance on the green side of the spectrum';
        } else if (hsl.h > 165 && hsl.h <= 260) {
            temperature = 'Cool Nordic';
            tempDetail = 'Cool blue-cyan undertones, receding depth characteristic';
        } else if (hsl.h > 260 && hsl.h <= 315) {
            temperature = 'Cool-Warm Transition (Violet/Magenta)';
            tempDetail = 'Spans cool blue and warm red, creating dynamic gradient tension';
        } else {
            temperature = 'Warm Fiery';
            tempDetail = 'Energetic red-orange warmth, advancing visual characteristic';
        }

        // 3. Saturation Profile
        let saturationClass = 'Muted';
        if (hsl.s >= 85) saturationClass = 'Vibrant / Neon';
        else if (hsl.s >= 60) saturationClass = 'Rich / Vivid';
        else if (hsl.s >= 35) saturationClass = 'Natural / Organic';
        else if (hsl.s >= 12) saturationClass = 'Muted / Soft';
        else saturationClass = 'Desaturated / Neutral';

        return {
            toneCategory,
            toneDetail,
            temperature,
            tempDetail,
            saturationClass,
            luminance: parseFloat((lab.L).toFixed(1)),
            undertoneHue: hsl.h,
            perceptualSaturation: hsl.s
        };
    }

    /* -----------------------------
       WCAG Accessibility Metrics
    ----------------------------- */

    static getRelativeLuminance(r, g, b) {
        const toLinear = (val) => {
            const v = val / 255;
            return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
        };
        return (0.2126 * toLinear(r)) + (0.7152 * toLinear(g)) + (0.0722 * toLinear(b));
    }

    static getContrastRatio(rgb1, rgb2) {
        const lum1 = ChromaEngine.getRelativeLuminance(rgb1.r, rgb1.g, rgb1.b);
        const lum2 = ChromaEngine.getRelativeLuminance(rgb2.r, rgb2.g, rgb2.b);
        const brightest = Math.max(lum1, lum2);
        const darkest = Math.min(lum1, lum2);
        return parseFloat(((brightest + 0.05) / (darkest + 0.05)).toFixed(2));
    }

    getAccessibility(hex) {
        const rgb = ChromaEngine.hexToRgb(hex);
        const white = { r: 255, g: 255, b: 255 };
        const black = { r: 0, g: 0, b: 0 };

        const contrastOnWhite = ChromaEngine.getContrastRatio(rgb, white);
        const contrastOnBlack = ChromaEngine.getContrastRatio(rgb, black);

        return {
            contrastOnWhite,
            contrastOnBlack,
            recommendedText: contrastOnWhite >= contrastOnBlack ? '#FFFFFF' : '#000000',
            aaNormalWhite: contrastOnWhite >= 4.5,
            aaLargeWhite: contrastOnWhite >= 3.0,
            aaaNormalWhite: contrastOnWhite >= 7.0,
            aaNormalBlack: contrastOnBlack >= 4.5,
            aaLargeBlack: contrastOnBlack >= 3.0,
            aaaNormalBlack: contrastOnBlack >= 7.0
        };
    }

    /* -----------------------------
       Harmonies & Tonal Scales
    ----------------------------- */

    generateHarmonies(hex) {
        const rgb = ChromaEngine.hexToRgb(hex);
        const hsl = ChromaEngine.rgbToHsl(rgb.r, rgb.g, rgb.b);

        const makeVariant = (hDelta, sDelta = 0, lDelta = 0) => {
            const newH = (hsl.h + hDelta + 360) % 360;
            const newS = Math.max(0, Math.min(100, hsl.s + sDelta));
            const newL = Math.max(0, Math.min(100, hsl.l + lDelta));
            const newRgb = ChromaEngine.hslToRgb(newH, newS, newL);
            const newHex = ChromaEngine.rgbToHex(newRgb.r, newRgb.g, newRgb.b);
            const named = this.findNearestColor(newHex);
            return {
                hex: newHex,
                name: named.name,
                family: named.family
            };
        };

        // Harmonies
        const complementary = makeVariant(180);
        const analogousLeft = makeVariant(-30);
        const analogousRight = makeVariant(30);
        const triadic1 = makeVariant(120);
        const triadic2 = makeVariant(240);
        const splitComp1 = makeVariant(150);
        const splitComp2 = makeVariant(210);

        // 7-step Tonal Scale (from deep shadow to pure tint)
        const tonalScale = [];
        const lightSteps = [15, 30, 45, 60, 75, 88, 96];
        for (let step of lightSteps) {
            const stepRgb = ChromaEngine.hslToRgb(hsl.h, hsl.s, step);
            const stepHex = ChromaEngine.rgbToHex(stepRgb.r, stepRgb.g, stepRgb.b);
            const stepNamed = this.findNearestColor(stepHex);
            tonalScale.push({
                hex: stepHex,
                name: stepNamed.name,
                lightness: step,
                isCurrent: Math.abs(hsl.l - step) <= 7
            });
        }

        return {
            complementary,
            analogous: [analogousLeft, analogousRight],
            triadic: [triadic1, triadic2],
            splitComplementary: [splitComp1, splitComp2],
            tonalScale
        };
    }

    /* -----------------------------
       Multi-sample Gradient Interpolator
    ----------------------------- */

    /**
     * Interpolates smooth intermediate steps between colors and names every stop
     */
    interpolateGradient(hexA, hexB, steps = 5) {
        const rgbA = ChromaEngine.hexToRgb(hexA);
        const rgbB = ChromaEngine.hexToRgb(hexB);
        const labA = ChromaEngine.rgbToLab(rgbA.r, rgbA.g, rgbA.b);
        const labB = ChromaEngine.rgbToLab(rgbB.r, rgbB.g, rgbB.b);

        const stops = [];
        for (let i = 0; i < steps; i++) {
            const t = i / (steps - 1);
            // Linear RGB interpolation to avoid gray dead zone
            const r = Math.round(Math.sqrt((1 - t) * Math.pow(rgbA.r, 2) + t * Math.pow(rgbB.r, 2)));
            const g = Math.round(Math.sqrt((1 - t) * Math.pow(rgbA.g, 2) + t * Math.pow(rgbB.g, 2)));
            const b = Math.round(Math.sqrt((1 - t) * Math.pow(rgbA.b, 2) + t * Math.pow(rgbB.b, 2)));

            const hex = ChromaEngine.rgbToHex(r, g, b);
            const named = this.findNearestColor(hex);
            const nuance = this.analyzeGradientNuance(hex);

            stops.push({
                stopPercent: Math.round(t * 100),
                hex,
                rgb: `rgb(${r}, ${g}, ${b})`,
                name: named.name,
                family: named.family,
                toneCategory: nuance.toneCategory,
                temperature: nuance.temperature
            });
        }

        return {
            cssLinear: `linear-gradient(90deg, ${hexA} 0%, ${hexB} 100%)`,
            cssRadial: `radial-gradient(circle, ${hexA} 0%, ${hexB} 100%)`,
            stops
        };
    }

    /* -----------------------------
       Surprise 1: Chromesthesia Web Audio Synthesizer
       Maps light hue/wavelength to resonant musical frequencies
    ----------------------------- */

    static getChromesthesiaFrequency(hue) {
        // Map Hue (0 - 360 deg) across a pleasant musical octave range (A3 220Hz to C5 523Hz)
        // Red (0) -> C4 (261.63Hz), Yellow (60) -> E4 (329.63Hz), Green (120) -> G4 (392Hz),
        // Cyan (180) -> A4 (440Hz), Blue (240) -> B4 (493.88Hz), Violet (300) -> C5 (523.25Hz)
        const baseFreq = 261.63; // C4
        const octaveSpan = 1.0;  // 1 full musical octave
        const freq = baseFreq * Math.pow(2, (hue / 360.0) * octaveSpan);
        return parseFloat(freq.toFixed(2));
    }

    static playColorTone(hex, duration = 1.2) {
        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (!AudioCtx) return;
            if (!ChromaEngine._audioCtx) {
                ChromaEngine._audioCtx = new AudioCtx();
            }
            const ctx = ChromaEngine._audioCtx;
            if (ctx.state === 'suspended') {
                ctx.resume();
            }

            const rgb = ChromaEngine.hexToRgb(hex);
            const hsl = ChromaEngine.rgbToHsl(rgb.r, rgb.g, rgb.b);
            const fundamental = ChromaEngine.getChromesthesiaFrequency(hsl.h);

            const now = ctx.currentTime;

            // Master gain with smooth envelope
            const masterGain = ctx.createGain();
            masterGain.gain.setValueAtTime(0.001, now);
            masterGain.gain.exponentialRampToValueAtTime(0.25, now + 0.08);
            masterGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

            // Biquad filter (brightness controlled by color Lightness)
            const filter = ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(400 + (hsl.l * 35), now);
            filter.Q.setValueAtTime(1.5, now);

            // Oscillator 1 (Fundamental tone: Sine wave)
            const osc1 = ctx.createOscillator();
            osc1.type = 'sine';
            osc1.frequency.setValueAtTime(fundamental, now);

            // Oscillator 2 (Harmonic overtone: Perfect fifth or octave)
            const osc2 = ctx.createOscillator();
            osc2.type = 'triangle';
            const overtone = hsl.s > 50 ? fundamental * 1.5 : fundamental * 2;
            osc2.frequency.setValueAtTime(overtone, now);

            // Subtle sub-gain for harmonic richness
            const harmGain = ctx.createGain();
            harmGain.gain.setValueAtTime(hsl.s / 250, now);

            osc1.connect(filter);
            osc2.connect(harmGain);
            harmGain.connect(filter);
            filter.connect(masterGain);
            masterGain.connect(ctx.destination);

            osc1.start(now);
            osc2.start(now);
            osc1.stop(now + duration);
            osc2.stop(now + duration);
        } catch (e) {
            console.warn("Audio synthesis unavailable:", e);
        }
    }

    /**
     * Synthesizes a two-tone harmonic chord between two colors (e.g. Normal vs Hover)
     */
    static playColorChord(hex1, hex2, duration = 0.9) {
        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (!AudioCtx) return;
            if (!ChromaEngine._audioCtx) {
                ChromaEngine._audioCtx = new AudioCtx();
            }
            const ctx = ChromaEngine._audioCtx;
            if (ctx.state === 'suspended') {
                ctx.resume();
            }

            const rgb1 = ChromaEngine.hexToRgb(hex1);
            const hsl1 = ChromaEngine.rgbToHsl(rgb1.r, rgb1.g, rgb1.b);
            const freq1 = ChromaEngine.getChromesthesiaFrequency(hsl1.h);

            const rgb2 = ChromaEngine.hexToRgb(hex2);
            const hsl2 = ChromaEngine.rgbToHsl(rgb2.r, rgb2.g, rgb2.b);
            const freq2 = ChromaEngine.getChromesthesiaFrequency(hsl2.h);

            const now = ctx.currentTime;

            const masterGain = ctx.createGain();
            masterGain.gain.setValueAtTime(0.001, now);
            masterGain.gain.exponentialRampToValueAtTime(0.22, now + 0.07);
            masterGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

            const osc1 = ctx.createOscillator();
            osc1.type = 'sine';
            osc1.frequency.setValueAtTime(freq1, now);

            const osc2 = ctx.createOscillator();
            osc2.type = 'sine';
            osc2.frequency.setValueAtTime(freq2, now);

            osc1.connect(masterGain);
            osc2.connect(masterGain);
            masterGain.connect(ctx.destination);

            osc1.start(now);
            osc2.start(now);
            osc1.stop(now + duration);
            osc2.stop(now + duration);
        } catch (e) {
            console.warn("Audio chord synthesis unavailable:", e);
        }
    }

    /* -----------------------------
       Surprise 2: Color Blindness Simulator (Machado & Brettel Matrices)
    ----------------------------- */

    simulateColorBlindness(hex) {
        const rgb = ChromaEngine.hexToRgb(hex);
        // Linearized RGB
        const rNorm = rgb.r / 255;
        const gNorm = rgb.g / 255;
        const bNorm = rgb.b / 255;

        const clampByte = (val) => Math.max(0, Math.min(255, Math.round(val * 255)));

        // 1. Protanopia (L-cone deficiency / Red-blind)
        const pR = 0.56667 * rNorm + 0.43333 * gNorm;
        const pG = 0.55833 * rNorm + 0.44167 * gNorm;
        const pB = 0.24167 * gNorm + 0.75833 * bNorm;
        const protanHex = ChromaEngine.rgbToHex(clampByte(pR), clampByte(pG), clampByte(pB));

        // 2. Deuteranopia (M-cone deficiency / Green-blind)
        const dR = 0.625 * rNorm + 0.375 * gNorm;
        const dG = 0.700 * rNorm + 0.300 * gNorm;
        const dB = 0.300 * gNorm + 0.700 * bNorm;
        const deutanHex = ChromaEngine.rgbToHex(clampByte(dR), clampByte(dG), clampByte(dB));

        // 3. Tritanopia (S-cone deficiency / Blue-blind)
        const tR = 0.950 * rNorm + 0.050 * gNorm;
        const tG = 0.43333 * gNorm + 0.56667 * bNorm;
        const tB = 0.475 * gNorm + 0.525 * bNorm;
        const tritanHex = ChromaEngine.rgbToHex(clampByte(tR), clampByte(tG), clampByte(tB));

        // 4. Achromatopsia (Monochrome / Total color blindness)
        const mono = 0.2126 * rNorm + 0.7152 * gNorm + 0.0722 * bNorm;
        const achroHex = ChromaEngine.rgbToHex(clampByte(mono), clampByte(mono), clampByte(mono));

        return {
            protanopia: {
                type: 'Protanopia (Red-Blind)',
                hex: protanHex,
                name: this.findNearestColor(protanHex).name,
                prevalence: '~1% of males'
            },
            deuteranopia: {
                type: 'Deuteranopia (Green-Blind)',
                hex: deutanHex,
                name: this.findNearestColor(deutanHex).name,
                prevalence: '~5% of males'
            },
            tritanopia: {
                type: 'Tritanopia (Blue-Blind)',
                hex: tritanHex,
                name: this.findNearestColor(tritanHex).name,
                prevalence: '<0.01% (rare)'
            },
            achromatopsia: {
                type: 'Achromatopsia (Monochrome)',
                hex: achroHex,
                name: this.findNearestColor(achroHex).name,
                prevalence: 'Total Color Blindness'
            }
        };
    }

    /* -----------------------------
       Surprise 3: Tailwind CSS Matcher
    ----------------------------- */

    static getTailwindMatch(hex) {
        const clean = ChromaEngine.cleanHex(hex);
        const rgb = ChromaEngine.hexToRgb(clean);

        // Core Tailwind 3.x palette reference
        const tailwindTokens = [
            { name: "slate-50", hex: "F8FAFC" }, { name: "slate-500", hex: "64748B" }, { name: "slate-900", hex: "0F172A" },
            { name: "red-500", hex: "EF4444" }, { name: "red-600", hex: "DC2626" }, { name: "red-700", hex: "B91C1C" },
            { name: "orange-500", hex: "F97316" }, { name: "orange-600", hex: "EA580C" },
            { name: "amber-400", hex: "FBBF24" }, { name: "amber-500", hex: "F59E0B" },
            { name: "yellow-400", hex: "FACC15" }, { name: "yellow-500", hex: "EAB308" },
            { name: "lime-500", hex: "84CC16" }, { name: "green-500", hex: "22C55E" }, { name: "green-600", hex: "16A34A" },
            { name: "emerald-500", hex: "10B981" }, { name: "emerald-600", hex: "059669" },
            { name: "teal-500", hex: "14B8A6" }, { name: "cyan-500", hex: "06B6D4" }, { name: "cyan-600", hex: "0891B2" },
            { name: "sky-400", hex: "38BDF8" }, { name: "sky-500", hex: "0EA5E9" }, { name: "sky-600", hex: "0284C7" },
            { name: "blue-500", hex: "3B82F6" }, { name: "blue-600", hex: "2563EB" }, { name: "blue-700", hex: "1D4ED8" },
            { name: "indigo-500", hex: "6366F1" }, { name: "indigo-600", hex: "4F46E5" }, { name: "indigo-700", hex: "4338CA" },
            { name: "violet-500", hex: "8B5CF6" }, { name: "violet-600", hex: "7C3AED" },
            { name: "purple-500", hex: "A855F7" }, { name: "fuchsia-500", hex: "D946EF" },
            { name: "pink-500", hex: "EC4899" }, { name: "rose-500", hex: "F43F5E" }
        ];

        let closest = tailwindTokens[0];
        let minD = Infinity;

        for (const token of tailwindTokens) {
            const trgb = ChromaEngine.hexToRgb(token.hex);
            const dist = Math.pow(rgb.r - trgb.r, 2) + Math.pow(rgb.g - trgb.g, 2) + Math.pow(rgb.b - trgb.b, 2);
            if (dist < minD) {
                minD = dist;
                closest = token;
            }
        }

        return {
            nearestToken: closest.name,
            nearestHex: `#${closest.hex}`,
            bgClass: `bg-${closest.name}`,
            textClass: `text-${closest.name}`,
            arbitraryBg: `bg-[#${clean}]`,
            arbitraryText: `text-[#${clean}]`
        };
    }

    /* -----------------------------
       Surprise 4: Emotional & Cultural Color Psychology
    ----------------------------- */

    static getColorPsychology(hex) {
        const rgb = ChromaEngine.hexToRgb(hex);
        const hsl = ChromaEngine.rgbToHsl(rgb.r, rgb.g, rgb.b);

        if (hsl.s <= 12) {
            return {
                archetype: "The Stoic Foundation",
                resonance: "Timeless Authority, Balance, & Minimalist Focus",
                psychology: "Neutral and achromatic tones eliminate cognitive noise, providing structural stability, sophistication, and focus in digital interfaces.",
                recommendedUsage: "Dominant backgrounds, technical documentation, typography, and premium subtle chrome."
            };
        }

        const h = hsl.h;
        if (h >= 345 || h < 15) {
            return {
                archetype: "The Catalyst",
                resonance: "Passion, Vitality, Urgency, & Emotional Power",
                psychology: "Red stimulates pulse rate and creates physical urgency. It commands immediate focus and primes the viewer for action.",
                recommendedUsage: "High-priority CTAs, notifications, alert states, and emotional hero brand accents."
            };
        } else if (h < 45) {
            return {
                archetype: "The Spark",
                resonance: "Creativity, Sociability, Enthusiasm, & Warmth",
                psychology: "Orange channels warmth without the severity of pure red. It projects playfulness, creative energy, and approachable innovation.",
                recommendedUsage: "Interactive accents, secondary highlights, active badges, and warm gradient bridges."
            };
        } else if (h < 70) {
            return {
                archetype: "The Illuminator",
                resonance: "Optimism, Intellect, Clarity, & High Visbility",
                psychology: "Yellow is the most luminous hue in the visible spectrum to the human eye. It conveys mental clarity, happiness, and rapid detection.",
                recommendedUsage: "Attention anchors, warning badges, sunny gradient highlights, and high-contrast dark mode badges."
            };
        } else if (h < 165) {
            return {
                archetype: "The Equilibrium",
                resonance: "Growth, Healing, Renewal, & Organic Vitality",
                psychology: "Green is the center of human visual wavelength perception. It requires zero eye muscle adjustment, producing restorative calm.",
                recommendedUsage: "Success states, eco/fintech interfaces, positive indicators, and refreshing background accents."
            };
        } else if (h < 200) {
            return {
                archetype: "The Innovator",
                resonance: "Clarity, Refreshment, Horizon, & Modern Precision",
                psychology: "Teal and Cyan merge the tranquil stability of blue with the vitality of green. They project high-tech intelligence and modern serenity.",
                recommendedUsage: "SaaS dashboards, AI accents, futuristic glowing borders, and modern gradient stops."
            };
        } else if (h < 260) {
            return {
                archetype: "The Anchor",
                resonance: "Trust, Depth, Wisdom, & Infinite Horizon",
                psychology: "Blue universally signals reliability, security, and institutional competence. It lowers respiration rates and fosters prolonged focus.",
                recommendedUsage: "Primary brand colors, enterprise navigation, core buttons, and dark mode ambient shadows."
            };
        } else if (h < 300) {
            return {
                archetype: "The Mystic",
                resonance: "Luxury, Mystery, Imagination, & Deep Prestige",
                psychology: "Historically the rarest pigment (Tyrian Purple, Lapis Lazuli). It merges the stability of blue with the energy of red to inspire reverence.",
                recommendedUsage: "Premium tier badges, creative applications, generative AI indicators, and royal glow accents."
            };
        } else {
            return {
                archetype: "The Alchemist",
                resonance: "Vibrancy, Compassion, Defiance, & Playfulness",
                psychology: "Magenta and Pink command visual intrigue by bridging both ends of the visible spectrum. They signal charisma and avant-garde energy.",
                recommendedUsage: "Avant-garde branding, consumer app accents, playful badges, and vibrant multi-stop mesh gradients."
            };
        }
    }

    /* -----------------------------
       Master Inspector Report
    ----------------------------- */

    analyzeColor(hex) {
        const clean = ChromaEngine.cleanHex(hex);
        const rgb = ChromaEngine.hexToRgb(clean);
        const hsl = ChromaEngine.rgbToHsl(rgb.r, rgb.g, rgb.b);
        const hsv = ChromaEngine.rgbToHsv(rgb.r, rgb.g, rgb.b);
        const cmyk = ChromaEngine.rgbToCmyk(rgb.r, rgb.g, rgb.b);
        const lab = ChromaEngine.rgbToLab(rgb.r, rgb.g, rgb.b);

        const nearest = this.findNearestColor(clean);
        const nuance = this.analyzeGradientNuance(clean);
        const a11y = this.getAccessibility(clean);
        const harmonies = this.generateHarmonies(clean);
        const blindness = this.simulateColorBlindness(clean);
        const tailwind = ChromaEngine.getTailwindMatch(clean);
        const psychology = ChromaEngine.getColorPsychology(clean);
        const audioFreq = ChromaEngine.getChromesthesiaFrequency(hsl.h);

        return {
            hex: `#${clean}`,
            hexRaw: clean,
            rgb,
            rgbString: `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`,
            rgbaString: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 1)`,
            hsl,
            hslString: `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`,
            hsv,
            hsvString: `hsv(${hsv.h}°, ${hsv.s}%, ${hsv.v}%)`,
            cmyk,
            cmykString: `cmyk(${cmyk.c}%, ${cmyk.m}%, ${cmyk.y}%, ${cmyk.k}%)`,
            lab,
            labString: `lab(${lab.L}% ${lab.a} ${lab.b})`,
            colorName: nearest.name,
            namedHex: `#${nearest.hex}`,
            colorFamily: nearest.family,
            matchDistance: nearest.distance,
            matchSimilarity: nearest.similarity,
            exactMatch: nearest.exactMatch,
            nuanceDescription: nearest.description,
            gradientNuance: nuance,
            accessibility: a11y,
            harmonies,
            colorBlindness: blindness,
            tailwind,
            psychology,
            audioFrequency: audioFreq
        };
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = ChromaEngine;
}

