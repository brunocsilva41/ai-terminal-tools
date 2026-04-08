import json
import subprocess
import sys


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


def run_multipass(args):
    return run_command(["multipass", *args])


def run_in_dokploy(instance_name, command):
    if not command.strip():
        return emit_result(
            "error",
            error="Missing remote command",
            data={"usage": 'python dokploy_manager.py exec <instance> "<command>"'},
            exit_code=2,
        )

    result = run_command(["multipass", "exec", instance_name, "--", "sh", "-lc", command])
    if not result["ok"]:
        return emit_result("error", error=result["error"], data=result, exit_code=result["returncode"])

    return emit_result(
        "success",
        data={
            "instance": instance_name,
            "command": command,
            "stdout": result["stdout"],
            "stderr": result["stderr"],
        },
    )


def get_dokploy_context():
    instances = run_multipass(["list", "--format", "json"])
    if not instances["ok"]:
        return emit_result("error", error=instances["error"], data=instances, exit_code=instances["returncode"])

    try:
        multipass_instances = json.loads(instances["stdout"])
    except json.JSONDecodeError as exc:
        return emit_result(
            "error",
            error=f"Failed to parse Multipass output: {exc}",
            data={"stdout": instances["stdout"]},
            exit_code=1,
        )

    swarm = run_command(["multipass", "exec", "dokploy", "--", "sh", "-lc", "docker service ls"])
    if not swarm["ok"]:
        swarm_services = "VM 'dokploy' not found or offline."
    else:
        swarm_services = swarm["stdout"]

    context = {
        "message": "Dokploy context collected",
        "multipass_instances": multipass_instances,
        "dokploy_info": {
            "default_vm": "dokploy",
            "service_ports": [3000, 80, 443],
            "api_path": "/api/trpc",
            "logs_path": "/var/lib/dokploy/logs",
            "docker_swarm_mode": "active",
        },
        "swarm_services": swarm_services,
    }
    return emit_result("success", data=context)


def main(argv=None):
    args = argv if argv is not None else sys.argv[1:]
    if not args or args[0] == "status":
        if len(args) > 1:
            return emit_result(
                "error",
                error="Invalid arguments",
                data={"usage": 'python dokploy_manager.py status | exec <instance> "<command>"'},
                exit_code=2,
            )
        return get_dokploy_context()

    action = args[0]
    if action == "exec":
        if len(args) < 3:
            return emit_result(
                "error",
                error="Missing instance name or command",
                data={"usage": 'python dokploy_manager.py exec <instance> "<command>"'},
                exit_code=2,
            )
        instance_name = args[1]
        command = " ".join(args[2:])
        return run_in_dokploy(instance_name, command)

    return emit_result(
        "error",
        error=f"Unknown action: {action}",
        data={"usage": 'python dokploy_manager.py status | exec <instance> "<command>"'},
        exit_code=2,
    )


if __name__ == "__main__":
    sys.exit(main())
