<#
  Generate-Occasions.ps1
  ----------------------
  Genereert voor elke auto in /data/vehicles.json een statische,
  SEO-vriendelijke detailpagina onder /occasions/<slug>/index.html,
  op basis van /templates/occasion-template.html.

  Gebruik (vanuit de projectmap "Altena Auto's"):
    powershell -ExecutionPolicy Bypass -File scripts\Generate-Occasions.ps1

  Draai dit script opnieuw na elke wijziging in data/vehicles.json
  (nieuwe auto, prijswijziging, status naar "verkocht", enz.).
  Dit is de volledige "admin"-workflow van deze statische site --
  zie README.md voor uitleg.
#>

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$dataPath = Join-Path $root "data/vehicles.json"
$templatePath = Join-Path $root "templates/occasion-template.html"
$outRoot = Join-Path $root "occasions"
$siteBaseUrl = "https://www.altenaautos.nl"

if (-not (Test-Path $dataPath)) { throw "Kan vehicles.json niet vinden op $dataPath" }
if (-not (Test-Path $templatePath)) { throw "Kan occasion-template.html niet vinden op $templatePath" }

$data = Get-Content $dataPath -Raw -Encoding UTF8 | ConvertFrom-Json
$template = Get-Content $templatePath -Raw -Encoding UTF8

function Format-Euro($n) {
  if ($null -eq $n) { return $null }
  $s = "{0:N0}" -f $n
  $s = $s -replace ",", "."
  $euro = [char]0x20AC
  return "$euro $s,-"
}
function Format-KM($n) {
  $s = "{0:N0}" -f $n
  $s = $s -replace ",", "."
  return "$s km"
}
function Esc($s) {
  if ($null -eq $s) { return "" }
  return [System.Net.WebUtility]::HtmlEncode([string]$s)
}

function Build-SpecRow($label, $value) {
  if ($null -eq $value -or [string]::IsNullOrWhiteSpace([string]$value)) { return "" }
  return "<tr><td>$(Esc $label)</td><td>$(Esc $value)</td></tr>`n"
}

$checkSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M4 12l6 6L20 6"/></svg>'
$carSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 13l1.5-4.5A2 2 0 0 1 6.4 7h11.2a2 2 0 0 1 1.9 1.5L21 13"/><rect x="2.5" y="13" width="19" height="6" rx="2"/><circle cx="7" cy="19" r="1.6"/><circle cx="17" cy="19" r="1.6"/></svg>'

$count = 0
New-Item -ItemType Directory -Force -Path $outRoot | Out-Null

foreach ($v in $data.vehicles) {
  $count++
  $outDir = Join-Path $outRoot $v.slug
  New-Item -ItemType Directory -Force -Path $outDir | Out-Null

  # ---- Prijs ----
  if ($v.status -eq "verkocht") {
    $priceDisplay = "Verkocht"
    $priceNote = "Deze auto is niet meer beschikbaar"
  } elseif ($v.priceOnRequest -or $null -eq $v.price) {
    $priceDisplay = "Prijs op aanvraag"
    $priceNote = "Neem contact op voor de actuele prijs"
  } else {
    $priceDisplay = Format-Euro $v.price
    $priceNote = "Rijklaarprijs"
  }

  # ---- Status ----
  $badgeHtml = ""
  $statusNoticeHtml = ""
  if ($v.status -eq "gereserveerd") {
    $badgeHtml = '<span class="badge badge-reserved" style="margin-bottom:14px;">Gereserveerd</span>'
    $statusNoticeHtml = '<div class="selected-vehicle-chip" style="background:#FBEFD9;border-color:rgba(180,116,14,0.3);"><span>Deze auto is op dit moment <strong>gereserveerd</strong>. Interesse? Neem contact op, dan laten we weten of er nog mogelijkheden zijn of houden we je op de hoogte.</span></div>'
  } elseif ($v.status -eq "verkocht") {
    $badgeHtml = '<span class="badge badge-sold" style="margin-bottom:14px;">Verkocht</span>'
    $statusNoticeHtml = '<div class="selected-vehicle-chip" style="background:var(--color-gray-100);border-color:var(--color-gray-300);"><span>Deze auto is inmiddels <strong>verkocht</strong>. Bekijk onze <a href="../../occasions.html">actuele occasions</a> voor vergelijkbare auto''s.</span></div>'
  }

  # ---- Galerij ----
  if ($v.images -and $v.images.Count -gt 0) {
    # Detailpagina's staan in /occasions/<slug>/, dus paden uit vehicles.json (relatief aan de root) krijgen "../../" ervoor.
    $mainSrc = "../../$($v.images[0])"
    $galleryMain = "<img src=`"$mainSrc`" alt=`"$(Esc $v.title)`" width=`"960`" height=`"720`">"
    $thumbs = ""
    for ($i = 0; $i -lt $v.images.Count; $i++) {
      $active = if ($i -eq 0) { " active" } else { "" }
      $thumbSrc = "../../$($v.images[$i])"
      $thumbs += "<button type=`"button`" class=`"$($active.Trim())`" data-src=`"$thumbSrc`"><img src=`"$thumbSrc`" alt=`"Foto $($i+1)`" loading=`"lazy`"></button>`n"
    }
    $galleryThumbs = $thumbs
  } else {
    $photoNote = if ($v.marktplaatsPhotoCount) { "Bekijk alle $($v.marktplaatsPhotoCount) foto's op Marktplaats" } else { "Foto's volgen binnenkort" }
    $galleryMain = "<div class=`"media-placeholder`" style=`"height:100%;`">$carSvg<span>$photoNote</span></div>"
    $galleryThumbs = ""
  }

  # ---- Specificaties ----
  $powerStr = if ($v.power) { "$($v.power.pk) pk ($($v.power.kw) kW)" } else { $null }
  $specRows = ""
  $specRows += Build-SpecRow "Merk" $v.brand
  $specRows += Build-SpecRow "Model" $v.model
  $specRows += Build-SpecRow "Uitvoering" $v.version
  $specRows += Build-SpecRow "Bouwjaar" $v.year
  $specRows += Build-SpecRow "Kilometerstand" (Format-KM $v.mileage)
  $specRows += Build-SpecRow "Brandstof" $v.fuel
  $specRows += Build-SpecRow "Transmissie" $(if ($v.transmissionGears) { "$($v.transmission), $($v.transmissionGears) versnellingen" } else { $v.transmission })
  $specRows += Build-SpecRow "Carrosserie" $v.bodyType
  $specRows += Build-SpecRow "Vermogen" $powerStr
  $specRows += Build-SpecRow "Cilinderinhoud" $v.displacement
  $specRows += Build-SpecRow "Aantal deuren" $v.doors
  $specRows += Build-SpecRow "Aantal zitplaatsen" $v.seats
  $specRows += Build-SpecRow "Kleur" $v.color
  $specRows += Build-SpecRow "APK" $v.apk
  $specRows += Build-SpecRow "Onderhoudsboekjes" $(if ($v.maintenanceBooklet -eq $true) { "Aanwezig" } elseif ($v.maintenanceBooklet -eq $false) { "Niet aanwezig" } else { $null })
  $specRows += Build-SpecRow "Dealeronderhouden" $(if ($v.dealerMaintained -eq $true) { "Ja" } else { $null })
  $specRows += Build-SpecRow "NAP-check" $(if ($v.nap -eq $true) { "Logisch bevonden" } else { $null })
  $specRows += Build-SpecRow "Eerste eigenaar" $(if ($v.firstOwner -eq $true) { "Ja" } else { $null })
  $specRows += Build-SpecRow "Aantal sleutels" $v.keys
  $specRows += Build-SpecRow "Garantie" $v.warranty
  $specRows += Build-SpecRow "Afleverkosten" $(if ($v.deliveryCosts -is [string]) { $v.deliveryCosts } elseif ($v.deliveryCosts) { Format-Euro $v.deliveryCosts } else { $null })
  $specRows += Build-SpecRow "BTW/marge" $v.vatMargin
  $specRows += Build-SpecRow "Motorrijtuigenbelasting" $v.roadTax
  $specRows += Build-SpecRow "Bandenmaat" $v.tireSize
  $specRows += Build-SpecRow "Afmetingen (L x B x H)" $v.dimensions
  $specRows += Build-SpecRow "Wielbasis" $v.wheelbase
  $specRows += Build-SpecRow "Laadvermogen" $v.loadCapacity
  $specRows += Build-SpecRow "Gewicht (GVW)" $v.gvw
  $specRows += Build-SpecRow "0-100 km/u" $v.acceleration
  $specRows += Build-SpecRow "Topsnelheid" $v.topSpeed
  $specRows += Build-SpecRow "Verbruik stad" $v.fuelConsumptionCity
  $specRows += Build-SpecRow "Verbruik snelweg" $v.fuelConsumptionHighway
  $specRows += Build-SpecRow "CO2-uitstoot" $v.co2
  $specRows += Build-SpecRow "Energielabel" $v.energyLabel

  # ---- Uitrusting ----
  if ($v.equipment -and $v.equipment.Count -gt 0) {
    $equipHtml = ($v.equipment | ForEach-Object { "<li>$checkSvg $(Esc $_)</li>" }) -join "`n"
  } else {
    $equipHtml = "<li style=`"color:var(--color-text-muted);`">Uitrustingsgegevens voor deze auto zijn nog niet beschikbaar. Vraag ernaar bij het bekijken van de auto.</li>"
  }

  # ---- Zekerheden / trust ----
  $trustItems = @()
  if ($v.nap -eq $true) { $trustItems += "NAP-gecontroleerd, logische kilometerstand" }
  if ($v.dealerMaintained -eq $true) { $trustItems += "Dealer onderhouden" }
  if ($v.maintenanceBooklet -eq $true) { $trustItems += "Onderhoudsboekjes aanwezig" }
  if ($v.firstOwner -eq $true) { $trustItems += "Eerste eigenaar" }
  $trustItems += "APK: $($v.apk)"
  $trustItems += "Voertuig geschikt voor alle milieu-/emissiezones"
  $trustHtml = ($trustItems | ForEach-Object { "<li>$checkSvg $(Esc $_)</li>" }) -join "`n"

  # ---- Marktplaats knop ----
  $mpBtn = ""
  if ($v.marktplaatsUrl) {
    $mpBtn = "<a href=`"$($v.marktplaatsUrl)`" target=`"_blank`" rel=`"noopener`" class=`"link-quiet`">Originele advertentie bekijken <svg class=`"ext-icon`" viewBox=`"0 0 24 24`" fill=`"none`" stroke=`"currentColor`" stroke-width=`"2.4`"><path d=`"M7 17L17 7M9 7h8v8`"/></svg></a>"
  }

  # ---- JSON-LD ----
  $availability = switch ($v.status) {
    "verkocht" { "https://schema.org/SoldOut" }
    "gereserveerd" { "https://schema.org/LimitedAvailability" }
    default { "https://schema.org/InStock" }
  }
  $ld = [ordered]@{
    "@context" = "https://schema.org"
    "@type" = "Car"
    "name" = $v.title
    "brand" = [ordered]@{ "@type" = "Brand"; "name" = $v.brand }
    "model" = $v.model
    "vehicleModelDate" = "$($v.year)"
    "mileageFromOdometer" = [ordered]@{"@type" = "QuantitativeValue"; "value" = $v.mileage; "unitCode" = "KMT" }
    "fuelType" = $v.fuel
    "vehicleTransmission" = $v.transmission
    "color" = $v.color
    "offers" = [ordered]@{
      "@type" = "Offer"
      "priceCurrency" = "EUR"
      "availability" = $availability
      "itemCondition" = "https://schema.org/UsedCondition"
      "url" = "$siteBaseUrl/occasions/$($v.slug)/"
      "seller" = [ordered]@{"@type" = "AutoDealer"; "name" = "Altena Auto's"; "telephone" = "+31621816055" }
    }
  }
  if (-not $v.priceOnRequest -and $v.price) { $ld.offers["price"] = $v.price }
  if ($v.images -and $v.images.Count -gt 0) { $ld["image"] = @($v.images | ForEach-Object { "$siteBaseUrl/$_" }) }
  $jsonLd = $ld | ConvertTo-Json -Depth 6 -Compress
  # Windows PowerShell en PowerShell 7 escapen anders; normaliseren zodat de uitvoer overal identiek is
  $bs = [string][char]92
  $jsonLd = $jsonLd.Replace($bs + "u0027", "'").Replace($bs + "u0026", "&").Replace($bs + "u003c", "<").Replace($bs + "u003e", ">")

  # ---- Overige tokens ----
  $ogImage = if ($v.images -and $v.images.Count -gt 0) { "$siteBaseUrl/$($v.images[0])" } else { "$siteBaseUrl/images/general/og-image.jpg" }
  $metaDesc = "$($v.title) uit $($v.year), $(Format-KM $v.mileage), $($v.fuel), $($v.transmission). $(if (-not $v.priceOnRequest) { Format-Euro $v.price } else { 'Prijs op aanvraag' }) bij Altena Auto's in 's-Hertogenbosch."
  $pageTitle = "$($v.title) | $(if (-not $v.priceOnRequest) { Format-Euro $v.price } else { 'Prijs op aanvraag' }) | Altena Auto's"

  $tokens = @{
    "{{PAGE_TITLE}}" = Esc $pageTitle
    "{{META_DESCRIPTION}}" = Esc $metaDesc
    "{{CANONICAL_URL}}" = "$siteBaseUrl/occasions/$($v.slug)/"
    "{{OG_IMAGE}}" = $ogImage
    "{{JSON_LD}}" = $jsonLd
    "{{BRAND}}" = Esc $v.brand
    "{{MODEL}}" = Esc $v.model
    "{{VERSION}}" = Esc $v.version
    "{{SLUG}}" = $v.slug
    "{{PRICE_DISPLAY}}" = Esc $priceDisplay
    "{{PRICE_NOTE}}" = Esc $priceNote
    "{{BADGE_HTML}}" = $badgeHtml
    "{{STATUS_NOTICE_HTML}}" = $statusNoticeHtml
    "{{GALLERY_MAIN_HTML}}" = $galleryMain
    "{{GALLERY_CLASS}}" = $(if ($v.status -eq "verkocht") { " is-sold" } else { "" })
    "{{GALLERY_THUMBS_HTML}}" = $galleryThumbs
    "{{SPEC_TABLE_ROWS}}" = $specRows
    "{{EQUIPMENT_LIST_HTML}}" = $equipHtml
    "{{TRUST_LIST_HTML}}" = $trustHtml
    "{{DESCRIPTION_TEXT}}" = Esc $v.description
    "{{MARKTPLAATS_BUTTON_HTML}}" = $mpBtn
    "{{YEAR}}" = "$($v.year)"
    "{{MILEAGE}}" = Format-KM $v.mileage
    "{{FUEL}}" = Esc $v.fuel
    "{{TRANSMISSION}}" = Esc $v.transmission
  }

  $out = $template
  foreach ($key in $tokens.Keys) {
    $out = $out.Replace($key, [string]$tokens[$key])
  }

  $outFile = Join-Path $outDir "index.html"
  [System.IO.File]::WriteAllText($outFile, $out, [System.Text.Encoding]::UTF8)
  Write-Host "Gegenereerd: occasions/$($v.slug)/index.html"
}

# ---- Verwijder pagina's van auto's die niet meer in vehicles.json staan ----
$slugs = @($data.vehicles | ForEach-Object { $_.slug })
Get-ChildItem -Path $outRoot -Directory | Where-Object { $slugs -notcontains $_.Name } | ForEach-Object {
  Remove-Item -Path $_.FullName -Recurse -Force
  Write-Host "Verwijderd (niet meer in voorraad): occasions/$($_.Name)/"
}

Write-Host ""
Write-Host "Klaar. $count occasionpagina('s) gegenereerd in /occasions/."

# ---- sitemap.xml ----
$staticUrls = @("", "occasions", "over-ons", "inruilen", "contact")
$urlEntries = foreach ($u in $staticUrls) { "  <url><loc>$siteBaseUrl/$u</loc></url>" }
$urlEntries += foreach ($v in $data.vehicles) { "  <url><loc>$siteBaseUrl/occasions/$($v.slug)/</loc></url>" }
$sitemap = "<?xml version=`"1.0`" encoding=`"UTF-8`"?>`n<urlset xmlns=`"http://www.sitemaps.org/schemas/sitemap/0.9`">`n" + ($urlEntries -join "`n") + "`n</urlset>`n"
[System.IO.File]::WriteAllText((Join-Path $root "sitemap.xml"), $sitemap, [System.Text.Encoding]::UTF8)
Write-Host "sitemap.xml bijgewerkt ($($staticUrls.Count + $data.vehicles.Count) URL's)."
