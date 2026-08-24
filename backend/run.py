"""
Starts the backend on http://localhost:8000.

    python backend/run.py

Stop it with Ctrl+C. After editing anything in `backend/app`, stop and start it
again to pick the change up.

WHY AUTO-RELOAD IS OFF
----------------------
`reload=True` makes uvicorn run a watcher process that spawns the real server as
a separate child process. On Windows that is a trap: if the parent is killed
any way other than Ctrl+C, the child survives, keeps holding port 8000, and goes
on answering requests with the OLD code. Starting a new server then appears to
work - uvicorn prints "running on 8000" - but the browser still talks to the
stale orphan, so edits seem to have no effect.

Running a single process avoids this completely: one process owns the port, and
stopping it actually stops it. If you do want auto-reload while developing, add
`reload=True` below, and always stop the server with Ctrl+C.
"""

import sys
from pathlib import Path

import uvicorn

# Make `import app.main` work no matter which folder you run this from.
sys.path.insert(0, str(Path(__file__).resolve().parent))

if __name__ == "__main__":
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000)
