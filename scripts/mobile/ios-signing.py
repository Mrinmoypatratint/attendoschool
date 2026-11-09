"""Load signing material from CI secrets; never print it or place it in source."""
import base64
import os
import plistlib
import secrets
import subprocess
from pathlib import Path


def run(*args):
    result = subprocess.run(args, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if result.returncode:
        # Command arguments can contain signing passwords; never print a traceback
        # or CalledProcessError containing the original argument list.
        raise SystemExit(args[0] + " " + args[1] + " failed; check the signing configuration.")
    return result.stdout


for name in ("IOS_CERTIFICATE_BASE64", "IOS_CERTIFICATE_PASSWORD", "IOS_PROFILE_BASE64", "IOS_TEAM_ID"):
    if not os.environ.get(name):
        raise SystemExit("Missing iOS signing secret: " + name)

temporary = Path(os.environ["RUNNER_TEMP"])
certificate = temporary / "distribution.p12"
certificate.write_bytes(base64.b64decode(os.environ["IOS_CERTIFICATE_BASE64"], validate=True))
profile = temporary / "app.mobileprovision"
profile.write_bytes(base64.b64decode(os.environ["IOS_PROFILE_BASE64"], validate=True))
profile_data = plistlib.loads(run("security", "cms", "-D", "-i", str(profile)))
expected_id = os.environ["IOS_TEAM_ID"] + ".online.attendoschool.app"
if profile_data["Entitlements"].get("application-identifier") != expected_id:
    raise SystemExit("Provisioning profile does not match the Apple team and online.attendoschool.app")
profiles = Path.home() / "Library/MobileDevice/Provisioning Profiles"
profiles.mkdir(parents=True, exist_ok=True)
(profiles / (profile_data["UUID"] + ".mobileprovision")).write_bytes(profile.read_bytes())
keychain = str(temporary / "app-signing.keychain-db")
password = secrets.token_urlsafe(32)
run("security", "create-keychain", "-p", password, keychain)
run("security", "set-keychain-settings", "-lut", "21600", keychain)
run("security", "unlock-keychain", "-p", password, keychain)
run("security", "import", str(certificate), "-P", os.environ["IOS_CERTIFICATE_PASSWORD"], "-A", "-t", "cert", "-f", "pkcs12", "-k", keychain)
run("security", "set-key-partition-list", "-S", "apple-tool:,apple:", "-k", password, keychain)
run("security", "list-keychains", "-d", "user", "-s", keychain)
with open(os.environ["GITHUB_ENV"], "a") as output:
    output.write("IOS_PROFILE_UUID=" + profile_data["UUID"] + "\n")
with (temporary / "ExportOptions.plist").open("wb") as output:
    plistlib.dump({
        "method": "app-store-connect",
        "teamID": os.environ["IOS_TEAM_ID"],
        "signingStyle": "manual",
        "provisioningProfiles": {"online.attendoschool.app": profile_data["UUID"]},
    }, output)
