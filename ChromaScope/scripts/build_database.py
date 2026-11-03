import urllib.request
import re
import json
import math

print("Fetching ntc.js...")
req = urllib.request.Request('https://chir.ag/projects/ntc/ntc.js', headers={'User-Agent': 'Mozilla/5.0'})
with urllib.request.urlopen(req) as resp:
    text = resp.read().decode('utf-8', errors='ignore')

# Extract [ "000000", "Black" ]
pattern = r'\["([0-9A-Fa-f]{6})",\s*"([^"]+)"\]'
matches = re.findall(pattern, text)
print(f"Parsed {len(matches)} colors from ntc.js")

# Standard CSS Named Colors list to ensure 100% web fidelity
css_colors = {
    "aliceblue": "F0F8FF", "antiquewhite": "FAEBD7", "aqua": "00FFFF", "aquamarine": "7FFFD4", "azure": "F0FFFF",
    "beige": "F5F5DC", "bisque": "FFE4C4", "black": "000000", "blanchedalmond": "FFEBCD", "blue": "0000FF",
    "blueviolet": "8A2BE2", "brown": "A52A2A", "burlywood": "DEB887", "cadetblue": "5F9EA0", "chartreuse": "7FFF00",
    "chocolate": "D2691E", "coral": "FF7F50", "cornflowerblue": "6495ED", "cornsilk": "FFF8DC", "crimson": "DC143C",
    "cyan": "00FFFF", "darkblue": "00008B", "darkcyan": "008B8B", "darkgoldenrod": "B8860B", "darkgray": "A9A9A9",
    "darkgreen": "006400", "darkkhaki": "BDB76B", "darkmagenta": "8B008B", "darkolivegreen": "556B2F",
    "darkorange": "FF8C00", "darkorchid": "9932CC", "darkred": "8B0000", "darksalmon": "E9967A", "darkseagreen": "8FBC8F",
    "darkslateblue": "483D8B", "darkslategray": "2F4F4F", "darkturquoise": "00CED1", "darkviolet": "9400D3",
    "deeppink": "FF1493", "deepskyblue": "00BFFF", "dimgray": "696969", "dodgerblue": "1E90FF", "firebrick": "B22222",
    "floralwhite": "FFFAF0", "forestgreen": "228B22", "fuchsia": "FF00FF", "gainsboro": "DCDCDC", "ghostwhite": "F8F8FF",
    "gold": "FFD700", "goldenrod": "DAA520", "gray": "808080", "green": "008000", "greenyellow": "ADFF2F",
    "honeydew": "F0FFF0", "hotpink": "FF69B4", "indianred": "CD5C5C", "indigo": "4B0082", "ivory": "FFFFF0",
    "khaki": "F0E68C", "lavender": "E6E6FA", "lavenderblush": "FFF0F5", "lawngreen": "7CFC00", "lemonchiffon": "FFFACD",
    "lightblue": "ADD8E6", "lightcoral": "F08080", "lightcyan": "E0FFFF", "lightgoldenrodyellow": "FAFAD2",
    "lightgray": "D3D3D3", "lightgreen": "90EE90", "lightpink": "FFB6C1", "lightsalmon": "FFA07A", "lightseagreen": "20B2AA",
    "lightskyblue": "87CEFA", "lightslategray": "778899", "lightsteelblue": "B0C4DE", "lightyellow": "FFFFE0",
    "lime": "00FF00", "limegreen": "32CD32", "linen": "FAF0E6", "magenta": "FF00FF", "maroon": "800000",
    "mediumaquamarine": "66CDAA", "mediumblue": "0000CD", "mediumorchid": "BA55D3", "mediumpurple": "9370DB",
    "mediumseagreen": "3CB371", "mediumslateblue": "7B68EE", "mediumspringgreen": "00FA9A", "mediumturquoise": "48D1CC",
    "mediumvioletred": "C71585", "midnightblue": "191970", "mintcream": "F5FFFA", "mistyrose": "FFE4E1",
    "moccasin": "FFE4B5", "navajowhite": "FFDEAD", "navy": "000080", "oldlace": "FDF5E6", "olive": "808000",
    "olivedrab": "6B8E23", "orange": "FFA500", "orangered": "FF4500", "orchid": "DA70D6", "palegoldenrod": "EEE8AA",
    "palegreen": "98FB98", "paleturquoise": "AFEEEE", "palevioletred": "DB7093", "papayawhip": "FFEFD5",
    "peachpuff": "FFDAB9", "peru": "CD853F", "pink": "FFC0CB", "plum": "DDA0DD", "powderblue": "B0E0E6",
    "purple": "800080", "rebeccapurple": "663399", "red": "FF0000", "rosybrown": "BC8F8F", "royalblue": "4169E1",
    "saddlebrown": "8B4513", "salmon": "FA8072", "sandybrown": "F4A460", "seagreen": "2E8B57", "seashell": "FFF5EE",
    "sienna": "A0522D", "silver": "C0C0C0", "skyblue": "87CEEB", "slateblue": "6A5ACD", "slategray": "708090",
    "snow": "FFFAFA", "springgreen": "00FF7F", "steelblue": "4682B4", "tan": "D2B48C", "teal": "008080",
    "thistle": "D8BFD8", "tomato": "FF6347", "turquoise": "40E0D0", "violet": "EE82EE", "wheat": "F5DEB3",
    "white": "FFFFFF", "whitesmoke": "F5F5F5", "yellow": "FFFF00", "yellowgreen": "9ACD32"
}

# Merge datasets
color_dict = {}
for hx, name in matches:
    hx = hx.upper()
    color_dict[hx] = name

for name, hx in css_colors.items():
    hx = hx.upper()
    # format nicely, e.g. "cornflowerblue" -> "Cornflower Blue" or keep CSS name
    formatted = re.sub(r'([a-z])([A-Z])', r'\1 \2', name).title()
    if hx not in color_dict:
        color_dict[hx] = formatted

print(f"Total merged distinct hexes: {len(color_dict)}")

# Helper to compute RGB -> Lab for high precision
def hex_to_rgb(hex_str):
    r = int(hex_str[0:2], 16)
    g = int(hex_str[2:4], 16)
    b = int(hex_str[4:6], 16)
    return r, g, b

def rgb_to_lab(r, g, b):
    # sRGB to Linear
    def pivot_rgb(c):
        c = c / 255.0
        return c / 12.92 if c <= 0.04045 else math.pow((c + 0.055) / 1.055, 2.4)
    
    lr = pivot_rgb(r)
    lg = pivot_rgb(g)
    lb = pivot_rgb(b)
    
    # Linear to XYZ (D65)
    x = (lr * 0.4124564 + lg * 0.3575761 + lb * 0.1804375) / 0.95047
    y = (lr * 0.2126729 + lg * 0.7151522 + lb * 0.0721750) / 1.00000
    z = (lr * 0.0193339 + lg * 0.1191920 + lb * 0.9503041) / 1.08883
    
    # XYZ to Lab
    def pivot_xyz(c):
        return math.pow(c, 1/3) if c > 0.008856 else (7.787 * c) + (16 / 116)
    
    fx = pivot_xyz(x)
    fy = pivot_xyz(y)
    fz = pivot_xyz(z)
    
    L = round((116 * fy) - 16, 2)
    a = round(500 * (fx - fy), 2)
    b_val = round(200 * (fy - fz), 2)
    return L, a, b_val

def get_color_family(r, g, b):
    # Determine general color family from HSL
    # Convert to HSL
    r_f, g_f, b_f = r/255.0, g/255.0, b/255.0
    c_max = max(r_f, g_f, b_f)
    c_min = min(r_f, g_f, b_f)
    delta = c_max - c_min
    l = (c_max + c_min) / 2.0
    
    if delta == 0:
        s = 0.0
        h = 0.0
    else:
        s = delta / (2.0 - c_max - c_min) if l > 0.5 else delta / (c_max + c_min)
        if c_max == r_f:
            h = ((g_f - b_f) / delta) % 6
        elif c_max == g_f:
            h = (b_f - r_f) / delta + 2
        else:
            h = (r_f - g_f) / delta + 4
        h = h * 60
        if h < 0: h += 360
    
    # Classify
    if l <= 0.08:
        return "Black / Dark Neutral"
    if l >= 0.94 and s <= 0.15:
        return "White / Light Neutral"
    if s <= 0.10:
        return "Gray / Achromatic"
    if s <= 0.25 and (h >= 20 and h <= 50):
        return "Brown / Warm Neutral"
    
    if (h >= 345 or h < 11):
        return "Red"
    elif h < 45:
        return "Orange"
    elif h < 70:
        return "Yellow"
    elif h < 165:
        return "Green"
    elif h < 200:
        return "Cyan / Teal"
    elif h < 260:
        return "Blue"
    elif h < 290:
        return "Purple / Indigo"
    elif h < 345:
        return "Pink / Magenta"
    return "Other"

entries = []
for hx, name in sorted(color_dict.items()):
    r, g, b = hex_to_rgb(hx)
    L, a, b_val = rgb_to_lab(r, g, b)
    fam = get_color_family(r, g, b)
    # entry format: [HEX, Name, L, a, b, Family]
    entries.append([hx, name, L, a, b_val, fam])

output_js = f"""// ChromaScope High-Precision Color Name Database
// {len(entries)} Curated Named Colors with Precomputed CIELAB values
// CIELAB coordinates (L, a, b) enable real-time sub-millisecond perceptual Delta-E matching

const COLOR_DATABASE = {json.dumps(entries, separators=(',', ':'))};

if (typeof module !== 'undefined' && module.exports) {{
    module.exports = {{ COLOR_DATABASE }};
}}
"""

with open('d:/AI/Projects/Extensions/ChromaScope/scripts/color-names.js', 'w', encoding='utf-8') as f:
    f.write(output_js)

print(f"Successfully generated color-names.js with {len(entries)} colors!")
