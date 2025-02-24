#!/bin/bash

# Check if Docker daemon is running
if ! docker info >/dev/null 2>&1; then
    echo "Docker is not running"

    # For macOS, try to start Docker desktop
    if [[ "$OSTYPE" == "darwin"* ]]; then
        echo "Starting Docker Desktop..."
        open -a Docker

        # Wait for Docker to start (timeout after 30 seconds)
        attempt=1
        max_attempts=30
        until docker info >/dev/null 2>&1 || [ $attempt -gt $max_attempts ]; do
            echo "Waiting for Docker to start... ($attempt/$max_attempts)"
            sleep 1
            ((attempt++))
        done

        if [ $attempt -gt $max_attempts ]; then
            echo "Timeout: Docker failed to start. Please start Docker manually."
            exit 1
        fi
    else
        # For Linux, try to start Docker service
        echo "Starting Docker service..."
        sudo service docker start || sudo systemctl start docker

        # Wait for Docker to start (timeout after 30 seconds)
        attempt=1
        max_attempts=30
        until docker info >/dev/null 2>&1 || [ $attempt -gt $max_attempts ]; do
            echo "Waiting for Docker to start... ($attempt/$max_attempts)"
            sleep 1
            ((attempt++))
        done

        if [ $attempt -gt $max_attempts ]; then
            echo "Timeout: Docker failed to start. Please start Docker manually."
            exit 1
        fi
    fi
fi

echo "Docker is running"

# Check if docker is running the redis container already
if docker ps | grep -q redis-server; then
    echo "Redis server already running"
else
    echo "Starting Redis server..."
    docker run --rm -d --name redis-server -p 6379:6379 redis
    echo "Redis server started"
    # Check if Redis is running
    if ! docker exec redis-server redis-cli ping >/dev/null 2>&1; then
        echo "Redis server failed to start"
        exit 1
    else
        echo "Redis server is running"
    fi
fi
