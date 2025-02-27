#!/bin/bash

# Configuration
SERVER_URL="http://localhost:3000"
AUTH_URL="$SERVER_URL/auth/google"
TOKEN_FILE="/tmp/gmail_token.txt"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}Gmail Webhook Testing Script${NC}"
echo "=================================="
echo "Please enter the token you received from the browser:"

# Function to make authenticated requests
make_request() {
    local method=$1
    local endpoint=$2
    local token=$3

    echo -e "\n${BLUE}Making $method request to $endpoint...${NC}"
    response=$(curl -s -X $method "$SERVER_URL$endpoint" \
        -H "Authorization: Bearer $token" \
        -H "Content-Type: application/json")

    echo -e "${GREEN}Response:${NC}"
    echo $response | jq . 2>/dev/null || echo $response
}

# Check if using dev mode
if [ "$1" == "dev" ]; then
    echo -e "\n${BLUE}Using development endpoints (no auth required)...${NC}"

    echo -e "\n${BLUE}Registering Gmail webhook (dev mode)...${NC}"
    response=$(curl -s -X POST "$SERVER_URL/webhook/dev-register-gmail")
    echo -e "${GREEN}Response:${NC}"
    echo $response | jq . 2>/dev/null || echo $response

    echo -e "\n${BLUE}Checking Gmail webhook status...${NC}"
    response=$(curl -s -X GET "$SERVER_URL/webhook/gmail-status")
    echo -e "${GREEN}Response:${NC}"
    echo $response | jq . 2>/dev/null || echo $response

    exit 0
fi

# Get token from browser or file
get_token() {
    if [ -f "$TOKEN_FILE" ] && [ $(find "$TOKEN_FILE" -mmin -55 | wc -l) -eq 1 ]; then
        # Token file exists and is less than 55 minutes old (tokens expire after 1 hour)
        echo -e "${GREEN}Using existing token from $TOKEN_FILE${NC}"
        cat "$TOKEN_FILE"
        return
    fi

    echo -e "${BLUE}Opening browser for Google authentication...${NC}"
    echo "Please authenticate in your browser and copy the token when displayed."

    # Open browser based on OS
    if [[ "$OSTYPE" == "darwin"* ]]; then
        open "$AUTH_URL"
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        xdg-open "$AUTH_URL" || gnome-open "$AUTH_URL" || kde-open "$AUTH_URL" || firefox "$AUTH_URL" || google-chrome "$AUTH_URL"
    elif [[ "$OSTYPE" == "msys" || "$OSTYPE" == "win32" ]]; then
        start "$AUTH_URL"
    else
        echo -e "${RED}Could not open browser automatically. Please visit:${NC}"
        echo "$AUTH_URL"
    fi

    echo -e "${BLUE}After authentication, please paste the token here:${NC}"
    read token

    # Save token to file
    echo "$token" >"$TOKEN_FILE"
    echo -e "${GREEN}Token saved to $TOKEN_FILE${NC}"

    echo "$token"
}

# Main execution
TOKEN=$(get_token)

if [ -z "$TOKEN" ]; then
    echo -e "${RED}No token provided. Exiting.${NC}"
    exit 1
fi

# Register Gmail webhook
make_request "POST" "/webhook/register-gmail" "$TOKEN"

# Check status
make_request "GET" "/webhook/gmail-status" "$TOKEN"

# Ask if user wants to unregister
echo -e "\n${BLUE}Do you want to unregister the Gmail webhook? (y/n)${NC}"
read -r answer
if [[ "$answer" =~ ^[Yy]$ ]]; then
    # Unregister Gmail webhook
    make_request "POST" "/webhook/unregister-gmail" "$TOKEN"

    # Check status again
    make_request "GET" "/webhook/gmail-status" "$TOKEN"
fi

echo -e "\n${GREEN}Script completed successfully!${NC}"
