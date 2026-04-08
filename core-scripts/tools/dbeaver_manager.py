import json
import os
import subprocess
import sys
from pathlib import Path


DEFAULT_TIMEOUT = 120


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


def get_dbeaver_connections():
    appdata = os.getenv("APPDATA")
    if not appdata:
        return {
            "ok": False,
            "error": "APPDATA environment variable is not set",
            "data": None,
        }

    path = Path(appdata) / "DBeaverData" / "workspace6" / "General" / ".dbeaver" / "data-sources.json"
    if not path.exists():
        return {
            "ok": False,
            "error": f"DBeaver workspace not found at: {path}",
            "data": None,
        }

    try:
        with path.open("r", encoding="utf-8") as handle:
            return {
                "ok": True,
                "data": json.load(handle),
            }
    except (OSError, json.JSONDecodeError) as exc:
        return {
            "ok": False,
            "error": f"Error reading data-sources.json: {exc}",
            "data": None,
        }


def execute_sql(con_name, sql_file):
    sql_path = Path(sql_file)
    if not sql_path.exists():
        return emit_result(
            "error",
            error=f"SQL file not found: {sql_path}",
            data={"usage": "python dbeaver_manager.py run <con_name> <file>"},
            exit_code=2,
        )

    result = run_command(["dbeaver", "-con", f"name={con_name}", "-f", str(sql_path)])
    if not result["ok"]:
        return emit_result("error", error=result["error"], data=result, exit_code=result["returncode"])

    return emit_result(
        "success",
        data={
            "message": "SQL executed successfully",
            "connection": con_name,
            "sql_file": str(sql_path),
            "stdout": result["stdout"],
            "stderr": result["stderr"],
        },
    )


def main(argv=None):
    args = argv if argv is not None else sys.argv[1:]

    if not args:
        return emit_result(
            "success",
            data={"message": "DBeaver Manager Active", "usage": "list | run <con_name> <file>"},
        )

    action = args[0]
    if action == "list":
        if len(args) > 1:
            return emit_result(
                "error",
                error="Invalid arguments",
                data={"usage": "python dbeaver_manager.py list | run <con_name> <file>"},
                exit_code=2,
            )

        connections = get_dbeaver_connections()
        if not connections["ok"]:
            return emit_result("error", error=connections["error"], data=connections, exit_code=2)
        return emit_result("success", data=connections["data"])

    if action == "run":
        if len(args) != 3:
            return emit_result(
                "error",
                error="Invalid arguments",
                data={"usage": "python dbeaver_manager.py run <con_name> <file>"},
                exit_code=2,
            )
        con_name = args[1]
        sql_file = args[2]
        return execute_sql(con_name, sql_file)

    return emit_result(
        "error",
        error=f"Unknown action: {action}",
        data={"usage": "python dbeaver_manager.py list | run <con_name> <file>"},
        exit_code=2,
    )


if __name__ == "__main__":
    sys.exit(main())
