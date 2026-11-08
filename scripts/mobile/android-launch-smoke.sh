#!/usr/bin/env bash
set -euo pipefail
apk="${1:?Pass the APK path}"
out="${2:-android-startup}"
package=online.attendoschool.app
mkdir -p "$out"
capture() {
  adb logcat -d > "$out/logcat.txt" 2>&1 || true
  adb logcat -b crash -d > "$out/crash.txt" 2>&1 || true
  adb exec-out screencap -p > "$out/screen.png" 2>/dev/null || true
}
trap capture EXIT
adb wait-for-device
adb install -r "$apk"
adb logcat -c
for attempt in 1 2 3; do
  adb shell am force-stop "$package"
  adb shell am start -W -n "$package/.MainActivity" > "$out/launch-$attempt.txt"
  sleep 4
  if ! adb shell pidof "$package" | tr -d '\r' | grep -q '[0-9]'; then
    echo "App exited during cold launch $attempt" >&2
    exit 1
  fi
done
ready=false
for attempt in $(seq 1 10); do
  adb shell uiautomator dump /sdcard/attendoschool-startup.xml >/dev/null 2>&1 || true
  adb pull /sdcard/attendoschool-startup.xml "$out/ui.xml" >/dev/null 2>&1 || true
  if [[ -f "$out/ui.xml" ]] && grep -q 'Choose Your Role' "$out/ui.xml"; then
    ready=true
    break
  fi
  sleep 3
done
if [[ "$ready" != true ]]; then
  echo 'The native process did not display the login form.' >&2
  exit 1
fi
adb logcat -b crash -d > "$out/crash.txt"
if grep -q "Process: $package" "$out/crash.txt"; then
  echo 'Android reported an application crash.' >&2
  exit 1
fi
echo 'Three cold launches passed and the login form is visible.'
