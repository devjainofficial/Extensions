Add-Type -AssemblyName System.Drawing

function Create-DashMorphIcon {
    param([int]$size, [string]$path)
    
    $bmp = New-Object System.Drawing.Bitmap $size, $size
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

    # Background gradient
    $rect = New-Object System.Drawing.Rectangle 0, 0, $size, $size
    $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        $rect,
        [System.Drawing.Color]::FromArgb(79, 70, 229),   # Indigo-600
        [System.Drawing.Color]::FromArgb(147, 51, 234),  # Purple-600
        45.0
    )
    
    # Rounded rect path
    $radius = [float]($size * 0.22)
    $pathObj = New-Object System.Drawing.Drawing2D.GraphicsPath
    $d = $radius * 2
    $pathObj.AddArc(0, 0, $d, $d, 180, 90)
    $pathObj.AddArc($size - $d, 0, $d, $d, 270, 90)
    $pathObj.AddArc($size - $d, $size - $d, $d, $d, 0, 90)
    $pathObj.AddArc(0, $size - $d, $d, $d, 90, 90)
    $pathObj.CloseFigure()

    $g.FillPath($brush, $pathObj)

    # Card shapes
    $cardBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(240, 255, 255, 255))
    $activeCardBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 96, 165, 250)) # Blue-400
    $accentBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 251, 191, 36)) # Amber-400

    # Card 1 (Top full width)
    $c1X = [float]($size * 0.18)
    $c1Y = [float]($size * 0.18)
    $c1W = [float]($size * 0.64)
    $c1H = [float]($size * 0.26)
    $cRad = [float]($size * 0.06)
    
    $p1 = New-Object System.Drawing.Drawing2D.GraphicsPath
    $p1.AddArc($c1X, $c1Y, $cRad*2, $cRad*2, 180, 90)
    $p1.AddArc($c1X+$c1W-$cRad*2, $c1Y, $cRad*2, $cRad*2, 270, 90)
    $p1.AddArc($c1X+$c1W-$cRad*2, $c1Y+$c1H-$cRad*2, $cRad*2, $cRad*2, 0, 90)
    $p1.AddArc($c1X, $c1Y+$c1H-$cRad*2, $cRad*2, $cRad*2, 90, 90)
    $p1.CloseFigure()
    $g.FillPath($activeCardBrush, $p1)

    # Card 2 (Bottom left)
    $c2X = [float]($size * 0.18)
    $c2Y = [float]($size * 0.52)
    $c2W = [float]($size * 0.29)
    $c2H = [float]($size * 0.30)
    $p2 = New-Object System.Drawing.Drawing2D.GraphicsPath
    $p2.AddArc($c2X, $c2Y, $cRad*2, $cRad*2, 180, 90)
    $p2.AddArc($c2X+$c2W-$cRad*2, $c2Y, $cRad*2, $cRad*2, 270, 90)
    $p2.AddArc($c2X+$c2W-$cRad*2, $c2Y+$c2H-$cRad*2, $cRad*2, $cRad*2, 0, 90)
    $p2.AddArc($c2X, $c2Y+$c2H-$cRad*2, $cRad*2, $cRad*2, 90, 90)
    $p2.CloseFigure()
    $g.FillPath($cardBrush, $p2)

    # Card 3 (Bottom right)
    $c3X = [float]($size * 0.53)
    $c3Y = [float]($size * 0.52)
    $c3W = [float]($size * 0.29)
    $c3H = [float]($size * 0.30)
    $p3 = New-Object System.Drawing.Drawing2D.GraphicsPath
    $p3.AddArc($c3X, $c3Y, $cRad*2, $cRad*2, 180, 90)
    $p3.AddArc($c3X+$c3W-$cRad*2, $c3Y, $cRad*2, $cRad*2, 270, 90)
    $p3.AddArc($c3X+$c3W-$cRad*2, $c3Y+$c3H-$cRad*2, $cRad*2, $cRad*2, 0, 90)
    $p3.AddArc($c3X, $c3Y+$c3H-$cRad*2, $cRad*2, $cRad*2, 90, 90)
    $p3.CloseFigure()
    $g.FillPath($cardBrush, $p3)

    # Little drag grip dot on top card
    if ($size -ge 32) {
        $dotBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 255, 255, 255))
        $dSize = [float]($size * 0.04)
        $g.FillEllipse($dotBrush, [float]($c1X + $c1W*0.3), [float]($c1Y + $c1H*0.45), $dSize, $dSize)
        $g.FillEllipse($dotBrush, [float]($c1X + $c1W*0.5), [float]($c1Y + $c1H*0.45), $dSize, $dSize)
        $g.FillEllipse($dotBrush, [float]($c1X + $c1W*0.7), [float]($c1Y + $c1H*0.45), $dSize, $dSize)
    }

    $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $bmp.Dispose()
}

Create-DashMorphIcon -size 16 -path "d:\AI\Projects\Extensions\DashMorph\icons\icon16.png"
Create-DashMorphIcon -size 32 -path "d:\AI\Projects\Extensions\DashMorph\icons\icon32.png"
Create-DashMorphIcon -size 48 -path "d:\AI\Projects\Extensions\DashMorph\icons\icon48.png"
Create-DashMorphIcon -size 128 -path "d:\AI\Projects\Extensions\DashMorph\icons\icon128.png"
Write-Output "Icons created successfully!"
