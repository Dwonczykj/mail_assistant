#!/bin/bash

# Check if ollama is installed
if ! command -v ollama &>/dev/null; then
    echo "ollama is not installed. Please install it first."
    exit 1
fi

# Function to check if ollama is running
is_ollama_running() {
    pgrep -x "ollama" >/dev/null
}

# Start ollama if not running
if ! is_ollama_running; then
    echo "Starting ollama..."
    ollama serve &

    # Wait for ollama to start
    while ! is_ollama_running; do
        echo "Waiting for ollama to start..."
        sleep 1
    done
    echo "ollama is running."
fi

# Read the first model name from the JSON file
MODEL_NAME=$(jq -r '.models[0].name' ./scripts/ollama_models.json)

# Check if the model is installed
if ! ollama list | grep -q "$MODEL_NAME"; then
    echo "Model '$MODEL_NAME' is not installed. Please install it."
    installed_models=$(ollama list)
    echo "Installed models:"
    echo "$installed_models"
    echo "Either install the model or change the model name in the ollama_models.json file to one of the installed models."
    exit 1
fi

# Function to check if the model is running
is_model_running() {
    ollama ps | grep -q "$MODEL_NAME"
}

# Start the model if not running
if ! is_model_running; then
    echo "Starting model '$MODEL_NAME'..."
    nohup ollama run "$MODEL_NAME" >/dev/null 2>&1 &

    # Wait for the model to start
    while ! is_model_running; do
        echo "Waiting for model '$MODEL_NAME' to start..."
        sleep 1
    done
    echo "Model '$MODEL_NAME' is running."
fi
