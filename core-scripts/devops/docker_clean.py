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


def parse_json_lines(output):
    items = []
    for line in output.splitlines():
        line = line.strip()
        if not line:
            continue
        items.append(json.loads(line))
    return items


def get_docker_stats():
    docker_ps = run_command(["docker", "ps", "-a", "--format", "{{json .}}"])
    if not docker_ps["ok"]:
        return emit_result("error", error=docker_ps["error"], data=docker_ps, exit_code=docker_ps["returncode"])

    docker_images = run_command(["docker", "images", "--format", "{{json .}}"])
    if not docker_images["ok"]:
        return emit_result("error", error=docker_images["error"], data=docker_images, exit_code=docker_images["returncode"])

    try:
        containers = parse_json_lines(docker_ps["stdout"])
        images = parse_json_lines(docker_images["stdout"])
    except json.JSONDecodeError as exc:
        return emit_result(
            "error",
            error=f"Failed to parse Docker JSON output: {exc}",
            data={
                "containers_stdout": docker_ps["stdout"],
                "images_stdout": docker_images["stdout"],
            },
            exit_code=1,
        )

    report = {
        "message": "Docker status collected",
        "containers_count": len(containers),
        "stopped_containers": [container.get("Names", "") for container in containers if "Exited" in container.get("Status", "")],
        "images_count": len(images),
        "dangling_images": [image.get("ID", "") for image in images if image.get("Repository") == "<none>"],
    }
    return emit_result("success", data=report)


def clean_docker():
    prune_container = run_command(["docker", "container", "prune", "-f"])
    if not prune_container["ok"]:
        return emit_result("error", error=prune_container["error"], data=prune_container, exit_code=prune_container["returncode"])

    prune_images = run_command(["docker", "image", "prune", "-f"])
    if not prune_images["ok"]:
        return emit_result("error", error=prune_images["error"], data=prune_images, exit_code=prune_images["returncode"])

    cleanup_report = {
        "message": "Docker cleanup completed",
        "container_prune": prune_container["stdout"],
        "image_prune": prune_images["stdout"],
    }
    return emit_result("success", data=cleanup_report)


def main(argv=None):
    args = argv if argv is not None else sys.argv[1:]
    if not args:
        return get_docker_stats()

    if len(args) == 1 and args[0] == "--clean":
        return clean_docker()

    return emit_result(
        "error",
        error="Invalid arguments",
        data={"usage": "python docker_clean.py [--clean]"},
        exit_code=2,
    )


if __name__ == "__main__":
    sys.exit(main())
