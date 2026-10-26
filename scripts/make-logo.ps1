<#
  make-logo.ps1
  -------------
  Maakt alle logo- en afbeeldingsbestanden van de website uit het nieuwe logo
  (lijntekening van een auto in een "A"-driehoek):
    images/logo/symbol.png         oranje logo op transparant (kop en voet van de site)
    images/logo/symbol-large.png   dunnere, grote versie
    images/logo/logo-512.png       vierkant logo op donker (Google, apps)
    favicon.ico, favicon-*.png, apple-touch-icon.png, icon-192/512.png
    images/general/og-image.jpg    1200x630 voorbeeldafbeelding (Google, WhatsApp, social)

  Gebruik:  .\scripts\make-logo.ps1 -Source "pad\naar\logo.png"
  Beste bron: het originele PNG/SVG-bestand met transparante achtergrond. Het
  bestand dat nu is gebruikt was een sterk gecomprimeerde JPEG, de lijnen zijn
  daaruit zo goed mogelijk herbouwd.
#>
param(
  [string]$Source = "C:\Users\Gebruiker\Downloads\WhatsApp Image 2026-10-26 at 16.55.31.jpeg"
)
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Add-Type -AssemblyName System.Drawing

$cs = @"
using System; using System.Collections.Generic; using System.Drawing; using System.Drawing.Imaging; using System.Runtime.InteropServices;
public static class LogoMaker {
  const float T0=1.2f, T1=5f;
  static float[] Load(string src, out int w, out int h) {
    using (var b = new Bitmap(src)) {
      w=b.Width; h=b.Height; var r=new Rectangle(0,0,w,h);
      var d=b.LockBits(r, ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
      int n=Math.Abs(d.Stride)*h; var buf=new byte[n]; Marshal.Copy(d.Scan0,buf,0,n); b.UnlockBits(d);
      var a=new float[w*h];
      for(int y=0;y<h;y++) for(int x=0;x<w;x++){ int i=y*d.Stride+x*4; float avg=(buf[i]+buf[i+1]+buf[i+2])/3f; float mx=Math.Max(buf[i],Math.Max(buf[i+1],buf[i+2])); float v=avg+(mx-avg)*0.5f;
        float s=(v-T0)/(T1-T0); a[y*w+x]=s<0?0:(s>1?1:s); }
      return a;
    }
  }
  static float[] Dilate(float[] a,int w,int h,int rad){
    if(rad<=0) return a; var t=new float[a.Length]; var o=new float[a.Length];
    for(int y=0;y<h;y++) for(int x=0;x<w;x++){ float m=0; for(int k=-rad;k<=rad;k++){int xx=x+k; if(xx<0||xx>=w) continue; float v=a[y*w+xx]; if(v>m)m=v;} t[y*w+x]=m; }
    for(int y=0;y<h;y++) for(int x=0;x<w;x++){ float m=0; for(int k=-rad;k<=rad;k++){int yy=y+k; if(yy<0||yy>=h) continue; float v=t[yy*w+x]; if(v>m)m=v;} o[y*w+x]=m; }
    return o;
  }
  static float[] Blur(float[] a,int w,int h,int rad){
    var t=new float[a.Length]; var o=new float[a.Length]; float inv=1f/(2*rad+1);
    for(int y=0;y<h;y++) for(int x=0;x<w;x++){ float s=0; for(int k=-rad;k<=rad;k++){int xx=Math.Min(w-1,Math.Max(0,x+k)); s+=a[y*w+xx];} t[y*w+x]=s*inv; }
    for(int y=0;y<h;y++) for(int x=0;x<w;x++){ float s=0; for(int k=-rad;k<=rad;k++){int yy=Math.Min(h-1,Math.Max(0,y+k)); s+=t[yy*w+x];} o[y*w+x]=s*inv; }
    return o;
  }
  // past een rechte lijn op de heldere pixels rond een geschat lijnstuk
  static double[] Fit(float[] a,int w,int h,double x0,double y0,double x1,double y1,double band){
    double[] seg={x0,y0,x1,y1};
    for(int it=0;it<3;it++){
      double dx=seg[2]-seg[0], dy=seg[3]-seg[1], len=Math.Sqrt(dx*dx+dy*dy), ux=dx/len, uy=dy/len;
      var pts=new List<double[]>();
      int minx=(int)Math.Max(0,Math.Min(seg[0],seg[2])-band), maxx=(int)Math.Min(w-1,Math.Max(seg[0],seg[2])+band);
      int miny=(int)Math.Max(0,Math.Min(seg[1],seg[3])-band), maxy=(int)Math.Min(h-1,Math.Max(seg[1],seg[3])+band);
      for(int y=miny;y<=maxy;y++) for(int x=minx;x<=maxx;x++){ if(a[y*w+x]<0.5f) continue;
        double px=x-seg[0], py=y-seg[1], t=px*ux+py*uy, d=Math.Abs(-px*uy+py*ux); if(t>=-band&&t<=len+band&&d<=band) pts.Add(new double[]{x,y}); }
      if(pts.Count<20) break;
      double mx=0,my=0; foreach(var p in pts){mx+=p[0];my+=p[1];} mx/=pts.Count; my/=pts.Count;
      double sxx=0,sxy=0,syy=0; foreach(var p in pts){ double ax=p[0]-mx, ay=p[1]-my; sxx+=ax*ax; sxy+=ax*ay; syy+=ay*ay; }
      double ang=0.5*Math.Atan2(2*sxy,sxx-syy); double vx=Math.Cos(ang), vy=Math.Sin(ang); if(vx*ux+vy*uy<0){vx=-vx;vy=-vy;}
      double t0=((seg[0]-mx)*vx+(seg[1]-my)*vy), t1=((seg[2]-mx)*vx+(seg[3]-my)*vy);
      seg=new double[]{mx+vx*t0,my+vy*t0,mx+vx*t1,my+vy*t1}; band=Math.Max(10,band*0.6);
    }
    return seg;
  }
  static void DrawSeg(float[] a,int w,int h,double[] s,double hw){
    double dx=s[2]-s[0], dy=s[3]-s[1], len2=dx*dx+dy*dy;
    int minx=(int)Math.Max(0,Math.Min(s[0],s[2])-hw-2), maxx=(int)Math.Min(w-1,Math.Max(s[0],s[2])+hw+2);
    int miny=(int)Math.Max(0,Math.Min(s[1],s[3])-hw-2), maxy=(int)Math.Min(h-1,Math.Max(s[1],s[3])+hw+2);
    for(int y=miny;y<=maxy;y++) for(int x=minx;x<=maxx;x++){
      double t=((x-s[0])*dx+(y-s[1])*dy)/len2; t=t<0?0:(t>1?1:t); double px=s[0]+t*dx-x, py=s[1]+t*dy-y; double d=Math.Sqrt(px*px+py*py);
      float v=(float)Math.Max(0,Math.Min(1,hw+0.7-d)); if(v>a[y*w+x]) a[y*w+x]=v; }
  }
  public static void Make(string src, string dst, int dilate, int blur, int pad, int maxSide, int r, int g, int bl, double lineHalf) {
    int w,h; var a=Load(src,out w,out h); int w2,h2; var raw=Load(src,out w2,out h2);
    // stippen buiten de auto weghalen, die vervangen we door rechte lijnen
    for(int y=0;y<h;y++) for(int x=0;x<w;x++){ bool car = x>330 && x<1175 && y>470 && y<1010; if(!car) a[y*w+x]=0; }
    var segs=new List<double[]>();
    segs.Add(Fit(raw,w,h,618,118,140,838,40));      // buitenste A, linkerzijde
    segs.Add(Fit(raw,w,h,618,118,985,615,40));      // rechterzijde boven
    segs.Add(Fit(raw,w,h,1150,800,1268,955,40));    // rechterzijde onder
    segs.Add(Fit(raw,w,h,140,838,345,730,40));      // basis links
    segs.Add(Fit(raw,w,h,1268,955,1150,880,40));    // basis rechts
    foreach(var s in segs) DrawSeg(a,w,h,s,lineHalf);
    a=Dilate(a,w,h,dilate); a=Blur(a,w,h,blur);
    for(int i=0;i<a.Length;i++){ float v=(a[i]-0.12f)/0.30f; a[i]=v<0?0:(v>1?1:v); }
    int minx=w,miny=h,maxx=0,maxy=0;
    for(int y=0;y<h;y++) for(int x=0;x<w;x++) if(a[y*w+x]>0.5f){ if(x<minx)minx=x; if(x>maxx)maxx=x; if(y<miny)miny=y; if(y>maxy)maxy=y; }
    int cw=maxx-minx+1+2*pad, ch=maxy-miny+1+2*pad;
    using (var big=new Bitmap(cw,ch,PixelFormat.Format32bppArgb)) {
      var rect=new Rectangle(0,0,cw,ch); var d=big.LockBits(rect,ImageLockMode.WriteOnly,PixelFormat.Format32bppArgb);
      var buf=new byte[Math.Abs(d.Stride)*ch];
      for(int y=0;y<ch;y++) for(int x=0;x<cw;x++){ int sx=x+minx-pad, sy=y+miny-pad; float v=(sx>=0&&sx<w&&sy>=0&&sy<h)?a[sy*w+sx]:0; int i=y*d.Stride+x*4; buf[i]=(byte)bl; buf[i+1]=(byte)g; buf[i+2]=(byte)r; buf[i+3]=(byte)(v*255); }
      Marshal.Copy(buf,0,d.Scan0,buf.Length); big.UnlockBits(d);
      double sc=Math.Min(1.0,(double)maxSide/Math.Max(cw,ch)); int nw=(int)(cw*sc), nh=(int)(ch*sc);
      using (var o=new Bitmap(nw,nh,PixelFormat.Format32bppArgb)) using (var gr=Graphics.FromImage(o)) {
        gr.InterpolationMode=System.Drawing.Drawing2D.InterpolationMode.HighQualityBicubic; gr.SmoothingMode=System.Drawing.Drawing2D.SmoothingMode.HighQuality; gr.PixelOffsetMode=System.Drawing.Drawing2D.PixelOffsetMode.HighQuality;
        gr.DrawImage(big,0,0,nw,nh); o.Save(dst,ImageFormat.Png);
      }
    }
  }
}
"@
Add-Type -TypeDefinition $cs -ReferencedAssemblies System.Drawing

$orange = [System.Drawing.Color]::FromArgb(236,102,8)
$ink = [System.Drawing.Color]::FromArgb(10,12,15)
$logoDir = Join-Path $root "images\logo"; $genDir = Join-Path $root "images\general"
New-Item -ItemType Directory -Force -Path $logoDir, $genDir | Out-Null

# 1. Het logo zelf (oranje op transparant)
[LogoMaker]::Make($Source, (Join-Path $logoDir "symbol.png"),       2, 2, 40, 700, 236,102,8, 4.5)
[LogoMaker]::Make($Source, (Join-Path $logoDir "symbol-large.png"), 1, 1, 30, 1400, 236,102,8, 2.5)
$sym = [System.Drawing.Image]::FromFile((Join-Path $logoDir "symbol.png"))
$symL = [System.Drawing.Image]::FromFile((Join-Path $logoDir "symbol-large.png"))

function New-Canvas($w,$h,$color){
  $b = New-Object System.Drawing.Bitmap $w,$h
  $g = [System.Drawing.Graphics]::FromImage($b)
  $g.SmoothingMode='HighQuality'; $g.InterpolationMode='HighQualityBicubic'; $g.TextRenderingHint='AntiAliasGridFit'; $g.PixelOffsetMode='HighQuality'
  if($color){ $g.Clear($color) }
  return @{ bmp=$b; g=$g }
}
function Save-Png($c,$path){ $c.g.Dispose(); $c.bmp.Save($path,[System.Drawing.Imaging.ImageFormat]::Png); $c.bmp.Dispose() }
function Draw-Fit($g,$img,$x,$y,$w,$h){
  $s=[Math]::Min($w/$img.Width,$h/$img.Height); $nw=$img.Width*$s; $nh=$img.Height*$s
  $g.DrawImage($img,[single]($x+($w-$nw)/2),[single]($y+($h-$nh)/2),[single]$nw,[single]$nh)
}

# 2. Vierkant logo op donker (Google, apps)
$c = New-Canvas 512 512 $ink; Draw-Fit $c.g $symL 56 56 400 400; Save-Png $c (Join-Path $logoDir "logo-512.png")

# 3. Favicon: oranje tegel met een witte "A"-driehoek (het logo is op 16-48 px niet leesbaar)
function New-Favicon($size,$rounded){
  $c = New-Canvas $size $size $null; $g=$c.g
  $r = if($rounded){ $size*0.22 } else { 0 }
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  if($rounded){ $d=$r*2; $path.AddArc(0,0,$d,$d,180,90); $path.AddArc($size-$d,0,$d,$d,270,90); $path.AddArc($size-$d,$size-$d,$d,$d,0,90); $path.AddArc(0,$size-$d,$d,$d,90,90); $path.CloseFigure() } else { $path.AddRectangle((New-Object System.Drawing.RectangleF 0,0,$size,$size)) }
  $g.FillPath((New-Object System.Drawing.SolidBrush $orange),$path)
  $pen = New-Object System.Drawing.Pen ([System.Drawing.Color]::White), ([single]($size*0.10)); $pen.LineJoin='Round'
  $pts = @((New-Object System.Drawing.PointF ($size*0.5),($size*0.18)), (New-Object System.Drawing.PointF ($size*0.84),($size*0.80)), (New-Object System.Drawing.PointF ($size*0.16),($size*0.80)))
  $g.DrawPolygon($pen,$pts)
  $pen2 = New-Object System.Drawing.Pen ([System.Drawing.Color]::White), ([single]($size*0.08)); $pen2.StartCap='Round'; $pen2.EndCap='Round'
  $g.DrawLine($pen2,[single]($size*0.36),[single]($size*0.60),[single]($size*0.64),[single]($size*0.60))
  return $c
}
foreach($s in 16,32,48){ $c = New-Favicon $s $true; Save-Png $c (Join-Path $root "favicon-$s.png") }
$c = New-Favicon 180 $false; Save-Png $c (Join-Path $root "apple-touch-icon.png")
$c = New-Favicon 192 $false; Save-Png $c (Join-Path $root "icon-192.png")
$c = New-Favicon 512 $false; Save-Png $c (Join-Path $root "icon-512.png")

# favicon.ico met 16, 32 en 48 px (PNG-gegevens in een ICO-bestand)
$ms = New-Object System.IO.MemoryStream; $bw = New-Object System.IO.BinaryWriter $ms
$sizes = 16,32,48; $imgs = foreach($s in $sizes){ ,[System.IO.File]::ReadAllBytes((Join-Path $root "favicon-$s.png")) }
$bw.Write([uint16]0); $bw.Write([uint16]1); $bw.Write([uint16]$sizes.Count)
$offset = 6 + 16*$sizes.Count
for($i=0;$i -lt $sizes.Count;$i++){ $s=$sizes[$i]; $bw.Write([byte]$s); $bw.Write([byte]$s); $bw.Write([byte]0); $bw.Write([byte]0); $bw.Write([uint16]1); $bw.Write([uint16]32); $bw.Write([uint32]$imgs[$i].Length); $bw.Write([uint32]$offset); $offset += $imgs[$i].Length }
foreach($b in $imgs){ $bw.Write($b) }
[System.IO.File]::WriteAllBytes((Join-Path $root "favicon.ico"),$ms.ToArray())

# 4. Voorbeeldafbeelding voor Google, WhatsApp en social (1200x630)
$c = New-Canvas 1200 630 $ink; $g = $c.g
$grad = New-Object System.Drawing.Drawing2D.LinearGradientBrush (New-Object System.Drawing.Rectangle 0,0,1200,630), ([System.Drawing.Color]::FromArgb(24,28,34)), $ink, 35
$g.FillRectangle($grad,0,0,1200,630)
$accent = New-Object System.Drawing.SolidBrush $orange
$g.FillRectangle($accent,0,0,1200,8)
Draw-Fit $g $symL 640 70 520 490
$f1 = New-Object System.Drawing.Font "Segoe UI Black",72,([System.Drawing.FontStyle]::Bold),([System.Drawing.GraphicsUnit]::Pixel)
$f2 = New-Object System.Drawing.Font "Segoe UI Semibold",34,([System.Drawing.FontStyle]::Regular),([System.Drawing.GraphicsUnit]::Pixel)
$f3 = New-Object System.Drawing.Font "Segoe UI",26,([System.Drawing.FontStyle]::Regular),([System.Drawing.GraphicsUnit]::Pixel)
$white = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White); $muted = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(190,255,255,255))
$g.DrawString("Altena",$f1,$white,56,150)
$g.DrawString("auto's!",$f1,$accent,56,225)
$g.DrawString("Betrouwbare occasions",$f2,$white,60,350)
$g.DrawString("in 's-Hertogenbosch",$f2,$white,60,394)
$dot = [string][char]0x00B7
$g.DrawString("Dealer onderhouden  $dot  NAP  $dot  APK",$f3,$muted,60,470)
$g.DrawString("altenaautos.nl",$f3,$accent,60,535)
$g.Dispose()
$jpeg = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq "image/jpeg" }
$ep = New-Object System.Drawing.Imaging.EncoderParameters 1; $ep.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter ([System.Drawing.Imaging.Encoder]::Quality), 90L
$c.bmp.Save((Join-Path $genDir "og-image.jpg"),$jpeg,$ep); $c.bmp.Dispose()
$sym.Dispose(); $symL.Dispose()
Write-Host "Klaar: logo, favicons en og-image staan in images/ en in de hoofdmap."
