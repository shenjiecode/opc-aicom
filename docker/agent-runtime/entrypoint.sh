#!/bin/bash

# Agent Runtime Entrypoint
# Starts the agent runner with environment configuration

echo "Starting Agent Runtime: $AGENT_NAME"
echo "Model: $AGENT_MODEL"
echo "Temperature: $AGENT_TEMPERATURE"

# Start the Python agent runner
exec python agent_runner.py