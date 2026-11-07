"""Store existing Apple credentials through notarytool's secure prompt."""
import errno
import os
import pty
import re
import select
import signal
import sys
import termios
import time


def store_profile(keychain, profile, command=None, timeout=90):
    password = os.environ["APPLE_APP_SPECIFIC_PASSWORD"]
    if any(character in password for character in "\r\n\0"):
        raise ValueError("Use an Apple app-specific password without line breaks.")
    args = (command or ["/usr/bin/xcrun", "notarytool"]) + [
        "store-credentials", profile, "--apple-id", os.environ["APPLE_ID"],
        "--team-id", os.environ["APPLE_TEAM_ID"], "--keychain", keychain,
    ]
    pid, descriptor = pty.fork()
    if pid == 0:
        try:
            os.execvpe(args[0], args, os.environ)
        except Exception:
            os._exit(127)
    output = bytearray()
    status = None
    submitted = False
    terminal_open = True
    deadline = time.monotonic() + timeout
    try:
        while status is None:
            if time.monotonic() >= deadline:
                raise TimeoutError("Notarization credential validation timed out. Retry the existing account.")
            if terminal_open and select.select([descriptor], [], [], .1)[0]:
                try:
                    chunk = os.read(descriptor, 8192)
                    if not chunk:
                        terminal_open = False
                    output.extend(chunk)
                except OSError as error:
                    if error.errno != errno.EIO:
                        raise
                    terminal_open = False
                if len(output) > 65536:
                    raise RuntimeError("Notarization credential validation returned excessive output.")
                if not submitted and re.search(rb"app-specific password[^\r\n]*:", output, re.I):
                    attributes = termios.tcgetattr(descriptor)
                    attributes[3] &= ~(termios.ECHO | termios.ECHONL)
                    termios.tcsetattr(descriptor, termios.TCSANOW, attributes)
                    os.write(descriptor, password.encode() + b"\n")
                    submitted = True
            else:
                time.sleep(.05)
            observed, result = os.waitpid(pid, os.WNOHANG)
            if observed:
                status = result
        if os.waitstatus_to_exitcode(status) != 0 or not submitted:
            detail = output.decode(errors="replace")[-3000:]
            for name in ["APPLE_APP_SPECIFIC_PASSWORD", "APPLE_ID", "APPLE_TEAM_ID"]:
                detail = detail.replace(os.environ[name], "[" + name + "]")
            raise RuntimeError("Could not validate/store the existing notarization credential: " + detail)
        print("PASS: notarization credential stored in the temporary signing keychain.")
    finally:
        if status is None:
            os.killpg(pid, signal.SIGKILL)
            os.waitpid(pid, 0)
        os.close(descriptor)


if __name__ == "__main__":
    try:
        store_profile(sys.argv[1], sys.argv[2])
    except Exception as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
