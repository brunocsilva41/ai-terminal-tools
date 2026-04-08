import json
import subprocess
import sys


DEFAULT_TIMEOUT = 60


def emit_result(status, data=None, error=None, exit_code=0):
    payload = {
        "status": status,
        "error": error,
        "data": data,
    }
    print(json.dumps(payload, indent=2, ensure_ascii=False))
    return exit_code


def run_command(args, timeout=DEFAULT_TIMEOUT):
    try:
        completed = subprocess.run(
            args,
            shell=False,
            check=False,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            timeout=timeout,
        )
    except FileNotFoundError:
        return {
            "ok": False,
            "error": f"Required command not found: {args[0]}",
            "returncode": 127,
            "stdout": "",
            "stderr": "",
        }
    except subprocess.TimeoutExpired as exc:
        return {
            "ok": False,
            "error": f"Command timed out after {timeout} seconds",
            "returncode": 124,
            "stdout": exc.stdout or "",
            "stderr": exc.stderr or "",
        }

    stdout = completed.stdout.strip()
    stderr = completed.stderr.strip()
    if completed.returncode != 0:
        return {
            "ok": False,
            "error": stderr or f"Command failed with exit code {completed.returncode}",
            "returncode": completed.returncode,
            "stdout": stdout,
            "stderr": stderr,
        }

    return {
        "ok": True,
        "returncode": completed.returncode,
        "stdout": stdout,
        "stderr": stderr,
    }


def check_git_repository():
    result = run_command(["git", "rev-parse", "--is-inside-work-tree"])
    if not result["ok"]:
        if result["returncode"] == 127:
            return result
        return {
            "ok": False,
            "error": "Not a git repository",
            "returncode": 2,
            "stdout": result["stdout"],
            "stderr": result["stderr"],
        }

    if result["stdout"].lower() != "true":
        return {
            "ok": False,
            "error": "Not a git repository",
            "returncode": 2,
            "stdout": result["stdout"],
            "stderr": result["stderr"],
        }

    return {
        "ok": True,
        "returncode": 0,
        "stdout": result["stdout"],
        "stderr": result["stderr"],
    }


def get_recent_commits():
    head = run_command(["git", "rev-parse", "--verify", "HEAD"])
    if not head["ok"]:
        return []

    result = run_command(["git", "log", "-n", "5", "--oneline"])
    if not result["ok"]:
        return []
    return [line for line in result["stdout"].splitlines() if line.strip()]


def analyze_diff():
    status = run_command(["git", "status", "--short"])
    if not status["ok"]:
        return emit_result("error", error=status["error"], data=status, exit_code=status["returncode"])

    unstaged = run_command(["git", "diff", "--stat"])
    if not unstaged["ok"]:
        return emit_result("error", error=unstaged["error"], data=unstaged, exit_code=unstaged["returncode"])

    staged = run_command(["git", "diff", "--cached", "--stat"])
    if not staged["ok"]:
        return emit_result("error", error=staged["error"], data=staged, exit_code=staged["returncode"])

    commits = get_recent_commits()
    report = {
        "message": "Git summary collected",
        "working_tree_status": [line for line in status["stdout"].splitlines() if line.strip()],
        "unstaged_changes": unstaged["stdout"] or "No unstaged changes.",
        "staged_changes": staged["stdout"] or "No staged changes.",
        "recent_commits": commits,
    }
    return emit_result("success", data=report)


def list_recent_commits():
    commits = get_recent_commits()
    return emit_result(
        "success",
        data={
            "message": "Recent commits collected",
            "recent_commits": commits,
        },
    )


def main(argv=None):
    args = argv if argv is not None else sys.argv[1:]
    action = args[0] if args else "analyze"

    if action not in {"analyze", "log"}:
        return emit_result(
            "error",
            error=f"Unknown action: {action}",
            data={"usage": "python git_analyzer.py [analyze|log]"},
            exit_code=2,
        )

    repo_check = check_git_repository()
    if not repo_check["ok"]:
        return emit_result(
            "error",
            error=repo_check["error"],
            data={"usage": "python git_analyzer.py [analyze|log]"},
            exit_code=repo_check["returncode"],
        )

    if action == "analyze":
        if len(args) > 1:
            return emit_result(
                "error",
                error="Invalid arguments",
                data={"usage": "python git_analyzer.py [analyze|log]"},
                exit_code=2,
            )
        return analyze_diff()

    if action == "log":
        if len(args) > 1:
            return emit_result(
                "error",
                error="Invalid arguments",
                data={"usage": "python git_analyzer.py [analyze|log]"},
                exit_code=2,
            )
        return list_recent_commits()

    return emit_result(
        "error",
        error=f"Unknown action: {action}",
        data={"usage": "python git_analyzer.py [analyze|log]"},
        exit_code=2,
    )


if __name__ == "__main__":
    sys.exit(main())
