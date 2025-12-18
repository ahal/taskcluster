#!/bin/sh
set -e

# Install docker if not already installed
if ! command -v docker > /dev/null 2>&1; then
    echo "Installing docker..."
    apt-get update -qq > /dev/null 2>&1
    apt-get install -y -qq docker.io > /dev/null 2>&1
    echo "Docker installed."
fi

# Get the docker group ID from the host socket
DOCKER_SOCK_GID=$(stat -c '%g' /var/run/docker.sock)
echo "Host docker socket group ID: $DOCKER_SOCK_GID"

# Remove the existing docker group if it has the wrong GID
if getent group docker > /dev/null 2>&1; then
    CURRENT_GID=$(getent group docker | cut -d: -f3)
    if [ "$CURRENT_GID" != "$DOCKER_SOCK_GID" ]; then
        echo "Removing docker group with wrong GID $CURRENT_GID"
        groupdel docker
    fi
fi

# Create docker group with matching GID if it doesn't exist
if ! getent group docker > /dev/null 2>&1; then
    groupadd -g $DOCKER_SOCK_GID docker
    echo "Created docker group with GID $DOCKER_SOCK_GID"
else
    echo "Docker group already exists with correct GID $DOCKER_SOCK_GID"
fi

# Run the original entrypoint
exec /entrypoint.sh "$@"
