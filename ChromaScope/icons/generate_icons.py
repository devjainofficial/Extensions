from PIL import Image, ImageDraw
import math

def create_chromascope_icon(size):
    # Render at 4x for high quality supersampling antialiasing
    scale = 4
    render_size = size * scale
    img = Image.new("RGBA", (render_size, render_size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    center = render_size / 2.0
    radius = (render_size / 2.0) * 0.92

    # Draw smooth gradient ring / chromatic wheel
    # We draw subtle concentric arcs with hue variation
    num_segments = 360
    ring_thickness = render_size * 0.16
    inner_radius = radius - ring_thickness

    for i in range(num_segments):
        angle_start = i
        angle_end = i + 1.5
        # Convert angle to hue
        hue = i / 360.0
        # Color from HSV
        # Smooth RGB calculation
        h_i = int(hue * 6)
        f = (hue * 6) - h_i
        q = 1.0 - f
        if h_i == 0:   r, g, b = 1.0, f, 0.0
        elif h_i == 1: r, g, b = q, 1.0, 0.0
        elif h_i == 2: r, g, b = 0.0, 1.0, f
        elif h_i == 3: r, g, b = 0.0, q, 1.0
        elif h_i == 4: r, g, b = f, 0.0, 1.0
        else:          r, g, b = 1.0, 0.0, q

        color = (int(r * 255), int(g * 255), int(b * 255), 245)

        # Draw segment arc
        draw.arc(
            [center - radius, center - radius, center + radius, center + radius],
            start=angle_start,
            end=angle_end,
            fill=color,
            width=int(ring_thickness)
        )

    # Dark core lens
    lens_radius = inner_radius - (render_size * 0.04)
    draw.ellipse(
        [center - lens_radius, center - lens_radius, center + lens_radius, center + lens_radius],
        fill=(18, 22, 34, 255),
        outline=(255, 255, 255, 40),
        width=int(render_size * 0.02)
    )

    # Subtle inner radial glow
    glow_radius = lens_radius * 0.65
    draw.ellipse(
        [center - glow_radius, center - glow_radius, center + glow_radius, center + glow_radius],
        fill=(35, 45, 75, 200)
    )

    # Stylized Eyedropper / Crosshair Loupe in center
    target_radius = render_size * 0.16
    draw.ellipse(
        [center - target_radius, center - target_radius, center + target_radius, center + target_radius],
        outline=(0, 235, 255, 240),
        width=max(1, int(render_size * 0.035))
    )

    # Center target dot
    dot_radius = render_size * 0.045
    draw.ellipse(
        [center - dot_radius, center - dot_radius, center + dot_radius, center + dot_radius],
        fill=(255, 255, 255, 255)
    )

    # Crosshair ticks
    tick_len = render_size * 0.08
    tick_w = max(1, int(render_size * 0.03))
    # North
    draw.line([center, center - target_radius - tick_len, center, center - target_radius + (tick_len*0.3)], fill=(0, 235, 255, 220), width=tick_w)
    # South
    draw.line([center, center + target_radius - (tick_len*0.3), center, center + target_radius + tick_len], fill=(0, 235, 255, 220), width=tick_w)
    # West
    draw.line([center - target_radius - tick_len, center, center - target_radius + (tick_len*0.3), center], fill=(0, 235, 255, 220), width=tick_w)
    # East
    draw.line([center + target_radius - (tick_len*0.3), center, center + target_radius + tick_len, center], fill=(0, 235, 255, 220), width=tick_w)

    # Resample with high quality Lanczos downsampling
    final_img = img.resize((size, size), Image.Resampling.LANCZOS)
    return final_img

for s in [16, 32, 48, 128]:
    im = create_chromascope_icon(s)
    im.save(f"d:/AI/Projects/Extensions/ChromaScope/icons/icon{s}.png", "PNG")
    print(f"Generated icons/icon{s}.png ({s}x{s})")

# Generate SVG
svg_content = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
  <defs>
    <linearGradient id="chromaGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FF3366" />
      <stop offset="25%" stop-color="#FF9933" />
      <stop offset="50%" stop-color="#33CC66" />
      <stop offset="75%" stop-color="#00CCFF" />
      <stop offset="100%" stop-color="#9933FF" />
    </linearGradient>
    <radialGradient id="lensGrad" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#24314E" />
      <stop offset="100%" stop-color="#0F1420" />
    </radialGradient>
  </defs>
  <!-- Outer Chromatic Ring -->
  <circle cx="64" cy="64" r="56" fill="none" stroke="url(#chromaGrad)" stroke-width="12" />
  <!-- Inner Lens Core -->
  <circle cx="64" cy="64" r="48" fill="url(#lensGrad)" stroke="#FFFFFF" stroke-opacity="0.15" stroke-width="1.5" />
  <!-- Loupe Reticle -->
  <circle cx="64" cy="64" r="20" fill="none" stroke="#00EBFF" stroke-width="3" />
  <circle cx="64" cy="64" r="5" fill="#FFFFFF" />
  <!-- Reticle Crosshairs -->
  <line x1="64" y1="36" x2="64" y2="48" stroke="#00EBFF" stroke-width="2.5" stroke-linecap="round" />
  <line x1="64" y1="80" x2="64" y2="92" stroke="#00EBFF" stroke-width="2.5" stroke-linecap="round" />
  <line x1="36" y1="64" x2="48" y2="64" stroke="#00EBFF" stroke-width="2.5" stroke-linecap="round" />
  <line x1="80" y1="64" x2="92" y2="64" stroke="#00EBFF" stroke-width="2.5" stroke-linecap="round" />
</svg>'''

with open("d:/AI/Projects/Extensions/ChromaScope/icons/icon.svg", "w", encoding="utf-8") as f:
    f.write(svg_content)
print("Generated icons/icon.svg")
