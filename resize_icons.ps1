Add-Type -AssemblyName System.Drawing
function Resize-Image {
    param(
        [string]$path,
        [int]$width,
        [int]$height
    )
    $img = [System.Drawing.Image]::FromFile($path)
    $newImg = New-Object System.Drawing.Bitmap($width, $height)
    $g = [System.Drawing.Graphics]::FromImage($newImg)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.DrawImage($img, 0, 0, $width, $height)
    $img.Dispose()
    $tempPath = $path + ".tmp.png"
    $newImg.Save($tempPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $newImg.Dispose()
    $g.Dispose()
    Move-Item -Path $tempPath -Destination $path -Force
}

Resize-Image -path "d:\Antigravity_WorkSpace\FidelityApp-MVP\public\pwa-192x192.png" -width 192 -height 192
Resize-Image -path "d:\Antigravity_WorkSpace\FidelityApp-MVP\public\pwa-512x512.png" -width 512 -height 512
