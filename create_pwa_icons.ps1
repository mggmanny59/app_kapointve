Add-Type -AssemblyName System.Drawing
function Create-Icon {
    param(
        [string]$src,
        [string]$dest,
        [int]$size
    )
    $img = [System.Drawing.Image]::FromFile($src)
    $newImg = New-Object System.Drawing.Bitmap($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($newImg)
    
    # Fondo blanco sólido para que el navegador no lo rechace por transparencia irregular
    $g.Clear([System.Drawing.Color]::White)
    
    # Mantener aspecto ratio
    $ratio = [Math]::Min($size / $img.Width, $size / $img.Height)
    $newW = [int]($img.Width * $ratio * 0.9) # Un poco más pequeño para dejar margen
    $newH = [int]($img.Height * $ratio * 0.9)
    $posX = [int](($size - $newW) / 2)
    $posY = [int](($size - $newH) / 2)
    
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.DrawImage($img, $posX, $posY, $newW, $newH)
    
    $img.Dispose()
    $newImg.Save($dest, [System.Drawing.Imaging.ImageFormat]::Png)
    $newImg.Dispose()
    $g.Dispose()
}

$baseDir = "d:\Antigravity_WorkSpace\FidelityApp-MVP\public"
$logoPath = Join-Path $baseDir "Logo KPoint Solo K (sin Fondo).png"
$icon192 = Join-Path $baseDir "pwa-192x192.png"
$icon512 = Join-Path $baseDir "pwa-512x512.png"

Create-Icon -src $logoPath -dest $icon192 -size 192
Create-Icon -src $logoPath -dest $icon512 -size 512
