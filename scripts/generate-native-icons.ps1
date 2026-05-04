Add-Type -AssemblyName System.Drawing

function New-RoundedRectPath {
  param(
    [System.Drawing.RectangleF]$Rect,
    [float]$Radius
  )

  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $d = $Radius * 2
  $path.AddArc($Rect.X, $Rect.Y, $d, $d, 180, 90)
  $path.AddArc($Rect.Right - $d, $Rect.Y, $d, $d, 270, 90)
  $path.AddArc($Rect.Right - $d, $Rect.Bottom - $d, $d, $d, 0, 90)
  $path.AddArc($Rect.X, $Rect.Bottom - $d, $d, $d, 90, 90)
  $path.CloseFigure()
  return $path
}

function New-SnapLinkIcon {
  param(
    [string]$Path,
    [int]$Size
  )

  $dir = Split-Path -Parent $Path
  if (-not (Test-Path -LiteralPath $dir)) {
    New-Item -ItemType Directory -Path $dir | Out-Null
  }

  $bmp = New-Object System.Drawing.Bitmap $Size, $Size
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
  $g.Clear([System.Drawing.Color]::Transparent)

  $pad = [Math]::Max(2, [int]($Size * 0.075))
  $rect = New-Object System.Drawing.RectangleF $pad, $pad, ($Size - 2 * $pad), ($Size - 2 * $pad)
  $round = New-RoundedRectPath -Rect $rect -Radius ([float]($Size * 0.28))

  $fill = New-Object System.Drawing.Drawing2D.LinearGradientBrush $rect, ([System.Drawing.Color]::FromArgb(255, 7, 17, 31)), ([System.Drawing.Color]::FromArgb(255, 0, 200, 255)), 45
  $blend = New-Object System.Drawing.Drawing2D.ColorBlend 3
  $blend.Colors = @(
    [System.Drawing.Color]::FromArgb(255, 7, 17, 31),
    [System.Drawing.Color]::FromArgb(255, 11, 72, 255),
    [System.Drawing.Color]::FromArgb(255, 0, 200, 255)
  )
  $blend.Positions = @(0, 0.52, 1)
  $fill.InterpolationColors = $blend
  $g.FillPath($fill, $round)

  $glow = New-Object System.Drawing.Drawing2D.PathGradientBrush $round
  $glow.CenterPoint = New-Object System.Drawing.PointF ([float]($Size * 0.28)), ([float]($Size * 0.22))
  $glow.CenterColor = [System.Drawing.Color]::FromArgb(160, 255, 255, 255)
  $glow.SurroundColors = @([System.Drawing.Color]::FromArgb(0, 11, 72, 255))
  $g.FillPath($glow, $round)

  $fontSize = [float]($Size * 0.73)
  $font = New-Object System.Drawing.Font 'Segoe UI Black', $fontSize, ([System.Drawing.FontStyle]::Bold), ([System.Drawing.GraphicsUnit]::Pixel)
  $format = New-Object System.Drawing.StringFormat
  $format.Alignment = [System.Drawing.StringAlignment]::Center
  $format.LineAlignment = [System.Drawing.StringAlignment]::Center
  $textRect = New-Object System.Drawing.RectangleF ([float]($Size * 0.04)), ([float]($Size * -0.005)), ([float]($Size * 0.92)), ([float]($Size * 1.02))
  $g.DrawString('S', $font, [System.Drawing.Brushes]::White, $textRect, $format)

  $slash = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(218, 119, 247, 255)), ([float]([Math]::Max(2, $Size * 0.07)))
  $slash.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $slash.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $g.DrawLine($slash, [float]($Size * 0.71), [float]($Size * 0.17), [float]($Size * 0.27), [float]($Size * 0.83))

  $shine = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(90, 255, 255, 255)), ([float]([Math]::Max(1, $Size * 0.025)))
  $shine.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $shine.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $g.DrawArc($shine, [float]($Size * 0.18), [float]($Size * 0.12), [float]($Size * 0.48), [float]($Size * 0.18), 190, 140)

  $bmp.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)

  $g.Dispose()
  $bmp.Dispose()
  $fill.Dispose()
  $glow.Dispose()
  $font.Dispose()
  $format.Dispose()
  $slash.Dispose()
  $shine.Dispose()
  $round.Dispose()
}

function New-SnapLinkSplash {
  param(
    [string]$Path,
    [int]$Width = 2732,
    [int]$Height = 2732
  )

  $bmp = New-Object System.Drawing.Bitmap $Width, $Height
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.Clear([System.Drawing.Color]::FromArgb(255, 2, 6, 23))

  $tmp = [System.IO.Path]::GetTempFileName() + '.png'
  New-SnapLinkIcon -Path $tmp -Size ([Math]::Min([int]($Width * 0.23), [int]($Height * 0.23)))
  $icon = [System.Drawing.Image]::FromFile($tmp)
  $g.DrawImage($icon, (($Width - $icon.Width) / 2), (($Height - $icon.Height) / 2), $icon.Width, $icon.Height)
  $bmp.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)

  $icon.Dispose()
  $g.Dispose()
  $bmp.Dispose()
  Remove-Item -LiteralPath $tmp -Force
}

New-SnapLinkIcon -Path 'ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png' -Size 1024

$androidIcons = @(
  @{ Path = 'android/app/src/main/res/mipmap-mdpi/ic_launcher.png'; Size = 48 },
  @{ Path = 'android/app/src/main/res/mipmap-mdpi/ic_launcher_round.png'; Size = 48 },
  @{ Path = 'android/app/src/main/res/mipmap-mdpi/ic_launcher_foreground.png'; Size = 108 },
  @{ Path = 'android/app/src/main/res/mipmap-hdpi/ic_launcher.png'; Size = 72 },
  @{ Path = 'android/app/src/main/res/mipmap-hdpi/ic_launcher_round.png'; Size = 72 },
  @{ Path = 'android/app/src/main/res/mipmap-hdpi/ic_launcher_foreground.png'; Size = 162 },
  @{ Path = 'android/app/src/main/res/mipmap-xhdpi/ic_launcher.png'; Size = 96 },
  @{ Path = 'android/app/src/main/res/mipmap-xhdpi/ic_launcher_round.png'; Size = 96 },
  @{ Path = 'android/app/src/main/res/mipmap-xhdpi/ic_launcher_foreground.png'; Size = 216 },
  @{ Path = 'android/app/src/main/res/mipmap-xxhdpi/ic_launcher.png'; Size = 144 },
  @{ Path = 'android/app/src/main/res/mipmap-xxhdpi/ic_launcher_round.png'; Size = 144 },
  @{ Path = 'android/app/src/main/res/mipmap-xxhdpi/ic_launcher_foreground.png'; Size = 324 },
  @{ Path = 'android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png'; Size = 192 },
  @{ Path = 'android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_round.png'; Size = 192 },
  @{ Path = 'android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_foreground.png'; Size = 432 }
)

foreach ($icon in $androidIcons) {
  New-SnapLinkIcon -Path $icon.Path -Size $icon.Size
}

$splashes = @(
  'android/app/src/main/res/drawable/splash.png',
  'android/app/src/main/res/drawable-port-mdpi/splash.png',
  'android/app/src/main/res/drawable-port-hdpi/splash.png',
  'android/app/src/main/res/drawable-port-xhdpi/splash.png',
  'android/app/src/main/res/drawable-port-xxhdpi/splash.png',
  'android/app/src/main/res/drawable-port-xxxhdpi/splash.png',
  'android/app/src/main/res/drawable-land-mdpi/splash.png',
  'android/app/src/main/res/drawable-land-hdpi/splash.png',
  'android/app/src/main/res/drawable-land-xhdpi/splash.png',
  'android/app/src/main/res/drawable-land-xxhdpi/splash.png',
  'android/app/src/main/res/drawable-land-xxxhdpi/splash.png'
)

foreach ($splash in $splashes) {
  New-SnapLinkSplash -Path $splash
}

Write-Host 'Generated SnapLink native icons.'
