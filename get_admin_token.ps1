$uri = "http://localhost:4002/api/auth/login"
$body = @{
    username = "admin"
    password = "admin"
} | ConvertTo-Json

try {
    $response = Invoke-WebRequest -Uri $uri -Method POST -ContentType "application/json" -Body $body -ErrorAction Stop
    $jsonResponse = $response.Content | ConvertFrom-Json
    $token = $jsonResponse.token
    Write-Host "Admin JWT Token: $token"
    Write-Host "Full Response: $($response.Content)"
} catch {
    Write-Host "Error obtaining token:"
    $_ | Format-List *
    if ($_.Exception.Response) {
        Write-Host "Response Content: $([System.Text.Encoding]::UTF8.GetString($_.Exception.Response.GetResponseStream().ToArray()))"
    }
}
