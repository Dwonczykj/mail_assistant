#!/bin/bash

# Generate test token
npx ts-node test/generate-test-token.ts

# Run the tests
npm test -- test/gmail-webhook.test.ts
