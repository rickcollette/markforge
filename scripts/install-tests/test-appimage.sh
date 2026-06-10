#!/bin/bash
# Runs the MarkForge AppImage on a clean RPM-based container (Rocky Linux 10).
# EL10 is Wayland-only (no Xvfb/Xorg), so the minimal GUI is a headless
# Weston compositor with Xwayland.
# Pass criteria: the app process stays alive AND a WebKit web process is
# running (i.e. the webview actually initialized, not just the GTK shell).
#   $1 = glob for the .AppImage inside the container
#   $2 = label for log output
set -ex

APPIMAGE=$(ls $1)
LABEL=$2

dnf -y -q install epel-release
dnf config-manager --set-enabled crb   # weston deps (libturbojpeg) live in CRB
dnf -y install weston xorg-x11-server-Xwayland dbus dbus-x11 \
    gtk3 mesa-dri-drivers mesa-libEGL mesa-libGL mesa-libgbm procps-ng \
    egl-utils || true

cp "$APPIMAGE" /tmp/markforge.AppImage
chmod +x /tmp/markforge.AppImage

export XDG_RUNTIME_DIR=/tmp/xdg
mkdir -p "$XDG_RUNTIME_DIR" && chmod 700 "$XDG_RUNTIME_DIR"
# Xwayland needs this directory; normally systemd-tmpfiles creates it.
mkdir -p /tmp/.X11-unix && chmod 1777 /tmp/.X11-unix

weston --backend=headless --width=1280 --height=800 --xwayland \
    --socket=wayland-1 &>/tmp/weston.log &
sleep 3

export WAYLAND_DISPLAY=wayland-1
export DISPLAY=:0

# No FUSE inside containers; extract-and-run instead of mounting.
export APPIMAGE_EXTRACT_AND_RUN=1
export WEBKIT_DISABLE_COMPOSITING_MODE=1 LIBGL_ALWAYS_SOFTWARE=1
export $(dbus-launch)

# Diagnostic: does EGL-on-X11 work at all in this container?
eglinfo -B 2>&1 | head -20 || true

run_check() {
    /tmp/markforge.AppImage &>/tmp/app.log &
    APP_PID=$!
    sleep 25
    kill -0 $APP_PID || return 1                 # UI process alive
    pgrep -af WebKitWebProcess || return 1       # renderer actually running
    return 0
}

if run_check; then
    echo "INSTALL TEST PASS: ${LABEL}"
else
    echo "--- first attempt failed, app log:"
    tail -10 /tmp/app.log
    pkill -f markforge || true
    sleep 3
    # Newer WebKit ignores WEBKIT_DISABLE_DMABUF_RENDERER; Skia CPU rendering
    # is the supported software fallback.
    export WEBKIT_SKIA_ENABLE_CPU_RENDERING=1 WEBKIT_DISABLE_DMABUF_RENDERER=1
    if run_check; then
        echo "INSTALL TEST PASS (cpu rendering): ${LABEL}"
    else
        echo "--- second attempt failed, app log:"
        tail -10 /tmp/app.log
        echo "INSTALL TEST FAIL: ${LABEL}"
        exit 1
    fi
fi
