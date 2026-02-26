$token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjEsInVzZXJuYW1lIjoiYWRtaW4iLCJlbWFpbCI6InN0YW5sZXlldG9ybmFtQGdtYWlsLmNvbSIsInBlcm1pc3Npb25zIjpbIioiXSwiY29tcGFueUlkcyI6WzFdLCJicmFuY2hJZHMiOlsxXSwiaWF0IjoxNzcxODgxMzMzLCJleHAiOjE3NzE5MTAxMzN9.ZHjWBASX2nebh5CaSHu8v1gfYJTGq6qw9DevdptSHT0"
$uri = "http://localhost:4002/api/admin/users"
$headers = @{
    "Authorization" = "Bearer $token"
}

Invoke-WebRequest -Uri $uri -Method GET -Headers $headers