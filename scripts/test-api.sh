#!/bin/bash

# API Integration Tests
# Tests: register -> login -> get info -> community list -> home stats

BASE_URL="http://localhost:8080"
TOKEN=""
FAILED=0

# Helper function to check for {code: 0}
check_code() {
    local response="$1"
    echo "$response" | grep -q '"code":0' || FAILED=1
}

echo "=== API Integration Tests ==="
echo ""

# Test 1: Register
echo "Test 1: POST /api/user/register"
REGISTER_RESPONSE=$(curl -s -X POST "$BASE_URL/api/user/register" \
    -H "Content-Type: application/json" \
    -d '{"username":"testuser","password":"testpass123"}')

echo "Request: {\"username\":\"testuser\",\"password\":\"testpass123\"}"
echo "Response: $REGISTER_RESPONSE"
check_code "$REGISTER_RESPONSE"
echo ""

# Test 2: Login
echo "Test 2: POST /api/user/login"
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/user/login" \
    -H "Content-Type: application/json" \
    -d '{"username":"testuser","password":"testpass123"}')

echo "Request: {\"username\":\"testuser\",\"password\":\"testpass123\"}"
echo "Response: $LOGIN_RESPONSE"
check_code "$LOGIN_RESPONSE"

# Extract token
if echo "$LOGIN_RESPONSE" | grep -q '"token"'; then
    TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
    echo "Token obtained: ${TOKEN:0:20}..."
fi
echo ""

# Test 3: Get User Info (with token)
echo "Test 3: POST /api/user/info"
if [ -n "$TOKEN" ]; then
    INFO_RESPONSE=$(curl -s -X POST "$BASE_URL/api/user/info" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $TOKEN")

    echo "Request: (with Authorization header)"
    echo "Response: $INFO_RESPONSE"
    check_code "$INFO_RESPONSE"
else
    echo "Skipped - no token available"
    FAILED=1
fi
echo ""

# Test 4: Community List
echo "Test 4: POST /api/community/list"
COMMUNITY_RESPONSE=$(curl -s -X POST "$BASE_URL/api/community/list" \
    -H "Content-Type: application/json")

echo "Request: (no body)"
echo "Response: $COMMUNITY_RESPONSE"
check_code "$COMMUNITY_RESPONSE"
echo ""

# Test 5: Home Stats
echo "Test 5: POST /api/home/stats"
STATS_RESPONSE=$(curl -s -X POST "$BASE_URL/api/home/stats" \
    -H "Content-Type: application/json")

echo "Request: (no body)"
echo "Response: $STATS_RESPONSE"
check_code "$STATS_RESPONSE"
echo ""

# Summary
echo "=== Test Summary ==="
if [ $FAILED -eq 0 ]; then
    echo "ALL TESTS PASSED"
    exit 0
else
    echo "SOME TESTS FAILED"
    exit 1
fi