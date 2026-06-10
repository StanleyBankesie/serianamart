$ErrorActionPreference = "Continue"

# Step 1: Login
Write-Host "=== STEP 1: Login ===" -ForegroundColor Cyan
$loginRes = Invoke-WebRequest -Uri "http://localhost:4002/api/auth/login" `
  -Method POST `
  -Headers @{"Content-Type"="application/json"} `
  -Body '{"email":"admin@omnisuite.com","password":"admin123"}' `
  -UseBasicParsing

$loginData = $loginRes.Content | ConvertFrom-Json
$token = $loginData.token
Write-Host "Login successful. Token: $($token.Substring(0,20))..." -ForegroundColor Green

# Step 2: Get user info
Write-Host "`n=== STEP 2: Get User Info ===" -ForegroundColor Cyan
$headers = @{
  "Authorization" = "Bearer $token"
  "Content-Type" = "application/json"
}

$meRes = Invoke-WebRequest -Uri "http://localhost:4002/api/admin/me" `
  -Headers $headers `
  -UseBasicParsing

$meData = $meRes.Content | ConvertFrom-Json
Write-Host "User ID: $($meData.id)" -ForegroundColor Green
Write-Host "Company IDs: $($meData.companyIds)" -ForegroundColor Green

# Step 3: Create a discount campaign
Write-Host "`n=== STEP 3: Create Discount Campaign ===" -ForegroundColor Cyan
$timestamp = [DateTime]::UtcNow.Ticks
$createPayload = @{
  scheme_code = "TEST-$timestamp"
  scheme_name = "Test Campaign $timestamp"
  discount_type = "PERCENTAGE"
  discount_value = 10
  effective_from = "2026-01-01"
  effective_to = "2026-12-31"
  min_quantity = 1
  description = "Test"
  is_active = 1
  itemIds = @()
} | ConvertTo-Json

$createRes = Invoke-WebRequest -Uri "http://localhost:4002/api/sales/discount-schemes/discount" `
  -Method POST `
  -Headers $headers `
  -Body $createPayload `
  -UseBasicParsing

$createData = $createRes.Content | ConvertFrom-Json
Write-Host "Created campaign ID: $($createData.id)" -ForegroundColor Green

# Step 4: Fetch all campaigns
Write-Host "`n=== STEP 4: Fetch All Discount Campaigns ===" -ForegroundColor Cyan
$fetchRes = Invoke-WebRequest -Uri "http://localhost:4002/api/sales/discount-schemes" `
  -Headers $headers `
  -UseBasicParsing

$fetchData = $fetchRes.Content | ConvertFrom-Json
Write-Host "Found campaigns: $($fetchData.items.Length)" -ForegroundColor Green
$fetchData.items | ForEach-Object { Write-Host "  - ID: $($_.id), Code: $($_.scheme_code), Name: $($_.scheme_name)" }

Write-Host "`nTest completed!" -ForegroundColor Green
