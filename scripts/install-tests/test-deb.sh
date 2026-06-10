#!/bin/bash
# Installs the MarkForge .deb in a clean Debian/Ubuntu container, launches the
# app under Xvfb (minimal headless GUI), and verifies a window appears.
#   $1 = glob for the .deb inside the container
#   $2 = label for log output
set -ex

DEB=$(ls $1)
LABEL=$2

export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
# The deb first (apt resolves webkit2gtk etc.), then the minimal GUI stack:
# Xvfb as the display server, dbus for the desktop session, xdotool to find
# the window.
apt-get install -y -qq "$DEB" xvfb x11-utils xdotool dbus dbus-x11 >/dev/null
command -v markforge

Xvfb :99 -screen 0 1280x800x24 &
export DISPLAY=:99
sleep 2

# Software rendering inside the container.
export WEBKIT_DISABLE_COMPOSITING_MODE=1 WEBKIT_DISABLE_DMABUF_RENDERER=1 LIBGL_ALWAYS_SOFTWARE=1
export $(dbus-launch)

markforge &
APP_PID=$!
sleep 20

kill -0 $APP_PID                                   # process still alive
xdotool search --onlyvisible --name "MarkForge"    # window exists
echo "INSTALL TEST PASS: ${LABEL}"
