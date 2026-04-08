import json
import subprocess
import sys
from pathlib import Path


DEFAULT_TIMEOUT = 600


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


def run_postman_collection(collection_path, env_path=None):
    collection = Path(collection_path)
    if not collection.exists():
        return emit_result(
            "error",
            error=f"Collection file not found: {collection}",
            data={"usage": 'python postman_manager.py <collection_json> [env_json]'},
            exit_code=2,
        )

    command = ["newman", "run", str(collection)]
    if env_path:
        env = Path(env_path)
        if not env.exists():
            return emit_result(
                "error",
                error=f"Environment file not found: {env}",
                data={"usage": 'python postman_manager.py <collection_json> [env_json]'},
                exit_code=2,
            )
        command.extend(["-e", str(env)])

    result = run_command(command)
    if not result["ok"]:
        return emit_result("error", error=result["error"], data=result, exit_code=result["returncode"])

    return emit_result(
        "success",
        data={
            "message": "Newman run completed",
            "collection_path": str(collection),
            "env_path": str(env_path) if env_path else None,
            "stdout": result["stdout"],
            "stderr": result["stderr"],
        },
    )


def main(argv=None):
    args = argv if argv is not None else sys.argv[1:]
    if not args:
        return emit_result(
            "error",
            error="Provide collection path",
            data={"usage": "python postman_manager.py <collection_json> [env_json]"},
            exit_code=2,
        )

    if len(args) > 2:
        return emit_result(
            "error",
            error="Invalid arguments",
            data={"usage": "python postman_manager.py <collection_json> [env_json]"},
            exit_code=2,
        )

    collection_path = args[0]
    env_path = args[1] if len(args) > 1 else None
    return run_postman_collection(collection_path, env_path)


if __name__ == "__main__":
    sys.exit(main())
