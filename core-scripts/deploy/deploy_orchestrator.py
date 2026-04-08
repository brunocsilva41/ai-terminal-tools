import argparse
import json
import shutil
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse


DEFAULT_TIMEOUT = 1200
CONFIRM_TOKEN = "DEPLOY_NOW"

GLOBAL_OFFICIAL_DOMAINS = [
    "docs.github.com",
    "docs.npmjs.com",
    "docs.docker.com",
    "kubernetes.io",
    "learn.microsoft.com",
    "cloud.google.com",
    "aws.amazon.com",
    "docs.aws.amazon.com",
]

OFFICIAL_DOMAINS_BY_MODE = {
    "artifact": ["docs.github.com"],
    "npm": ["docs.npmjs.com", "docs.github.com"],
    "docker": ["docs.docker.com", "docs.github.com"],
    "script": [],
}


def utc_now():
    return datetime.now(timezone.utc).isoformat()


def emit_result(status, data=None, error=None, exit_code=0):
    payload = {
        "status": status,
        "error": error,
        "data": data,
    }
    print(json.dumps(payload, indent=2, ensure_ascii=False))
    return exit_code


def run_command(args, cwd, timeout=DEFAULT_TIMEOUT):
    try:
        completed = subprocess.run(
            args,
            cwd=str(cwd),
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


def command_exists(command):
    return shutil.which(command) is not None


def resolve_command(candidates):
    for candidate in candidates:
        resolved = shutil.which(candidate)
        if resolved:
            return resolved
    return None


def normalize_research_refs(mode, refs_from_list, refs_csv):
    refs = list(refs_from_list or [])
    if refs_csv:
        refs.extend([item.strip() for item in refs_csv.split(",") if item.strip()])

    refs = [item for item in refs if item]
    unique_refs = []
    seen = set()
    for ref in refs:
        key = ref.strip()
        if key and key not in seen:
            unique_refs.append(key)
            seen.add(key)

    accepted_domains = sorted(set(GLOBAL_OFFICIAL_DOMAINS + OFFICIAL_DOMAINS_BY_MODE.get(mode, [])))
    official = []
    unofficial = []
    invalid = []
    for ref in unique_refs:
        parsed = urlparse(ref)
        if parsed.scheme not in {"http", "https"} or not parsed.netloc:
            invalid.append(ref)
            continue
        host = parsed.netloc.lower()
        is_official = any(host == domain or host.endswith(f".{domain}") for domain in accepted_domains)
        if is_official:
            official.append(ref)
        else:
            unofficial.append(ref)

    return {
        "all": unique_refs,
        "official": official,
        "unofficial": unofficial,
        "invalid": invalid,
        "accepted_domains": accepted_domains,
    }


def validate_research(mode, research_refs, allow_unofficial):
    if not research_refs["all"]:
        return {
            "ok": False,
            "error": "Research references are required. Use --research-ref <url>.",
            "data": research_refs,
        }
    if research_refs["invalid"]:
        return {
            "ok": False,
            "error": "Invalid research references detected. Use valid http/https URLs.",
            "data": research_refs,
        }
    if not research_refs["official"] and not allow_unofficial:
        return {
            "ok": False,
            "error": f"No official source matched for mode '{mode}'.",
            "data": research_refs,
        }
    return {"ok": True, "data": research_refs}


def build_confirmation_template(mode, environment, dry_run, image_tag=None, script_path=None):
    mode_label = {
        "artifact": "Gerar artefato (npm pack)",
        "npm": "Publicar pacote npm",
        "docker": "Build/push de imagem Docker",
        "script": "Executar script de deploy local",
    }[mode]

    checklist = [
        f"- Estratégia: `{mode}` ({mode_label})",
        f"- Ambiente alvo: `{environment}`",
        f"- Dry run: `{str(dry_run).lower()}`",
        "- Pesquisa oficial concluída e anexada",
        "- Rollback definido",
        "- Posso executar agora?",
    ]
    if mode == "docker":
        checklist.append(f"- image_tag: `{image_tag or '<obrigatório>'}`")
    if mode == "script":
        checklist.append(f"- script_path: `{script_path or '<obrigatório>'}`")

    return {
        "mode": mode,
        "environment": environment,
        "dry_run": dry_run,
        "required_confirmation_token": CONFIRM_TOKEN,
        "template_text": "Confirme enviando a frase exata: DEPLOY_NOW",
        "checklist": checklist,
    }


def build_plan(mode, cwd, environment, dry_run, image_tag=None, script_path=None, research=None):
    base_plan = {
        "mode": mode,
        "cwd": str(cwd),
        "environment": environment,
        "dry_run": dry_run,
        "pre_research_required": True,
        "confirmation_required": True,
        "confirmation_phrase": CONFIRM_TOKEN,
        "steps": [
            "1. Pesquisar documentação oficial da plataforma alvo.",
            "2. Confirmar estratégia, ambiente e rollback com o usuário.",
            "3. Rodar precheck técnico local.",
            "4. Executar deploy (apenas após confirmação explícita).",
            "5. Validar resultado e pedir confirmação final do usuário.",
        ],
        "confirmation_template": build_confirmation_template(mode, environment, dry_run, image_tag=image_tag, script_path=script_path),
        "research_status": research or {},
    }

    if mode == "artifact":
        base_plan["requirements"] = ["node", "npm", "package.json"]
        base_plan["actions"] = ["npm pack"]
    elif mode == "npm":
        base_plan["requirements"] = ["node", "npm", "package.json", "npm auth"]
        base_plan["actions"] = ["npm publish --provenance --access public"]
    elif mode == "docker":
        base_plan["requirements"] = ["docker", "Dockerfile"]
        base_plan["actions"] = [f"docker build -t {image_tag or '<image:tag>'} .", "docker push <image:tag> (opcional)"]
    elif mode == "script":
        base_plan["requirements"] = ["script local no workspace"]
        base_plan["actions"] = [f"execute local script: {script_path or '<script_path>'}"]

    return base_plan


def run_precheck(mode, cwd, image_tag=None, script_path=None):
    checks = []

    def add_check(name, ok, detail):
        checks.append({"name": name, "ok": ok, "detail": detail})

    if mode in {"artifact", "npm"}:
        node_cmd = resolve_command(["node", "node.exe"])
        npm_cmd = resolve_command(["npm", "npm.cmd", "npm.exe"])
        add_check("node", node_cmd is not None, f"node available in PATH ({node_cmd or 'not found'})")
        add_check("npm", npm_cmd is not None, f"npm available in PATH ({npm_cmd or 'not found'})")
        package_json = cwd / "package.json"
        add_check("package.json", package_json.exists(), str(package_json))

    if mode == "docker":
        docker_cmd = resolve_command(["docker", "docker.exe"])
        add_check("docker", docker_cmd is not None, f"docker available in PATH ({docker_cmd or 'not found'})")
        dockerfile = cwd / "Dockerfile"
        add_check("Dockerfile", dockerfile.exists(), str(dockerfile))
        if image_tag:
            add_check("image_tag", True, image_tag)
        else:
            add_check("image_tag", False, "Missing --image-tag")

    if mode == "script":
        if not script_path:
            add_check("script_path", False, "Missing --script-path")
        else:
            resolved = (cwd / script_path).resolve()
            try:
                resolved.relative_to(cwd.resolve())
                inside_workspace = True
            except ValueError:
                inside_workspace = False
            add_check("script_inside_workspace", inside_workspace, str(resolved))
            add_check("script_exists", resolved.exists(), str(resolved))

    failed = [item for item in checks if not item["ok"]]
    return {
        "ok": len(failed) == 0,
        "checks": checks,
        "failed_count": len(failed),
    }


def emit_precheck(mode, cwd, image_tag=None, script_path=None):
    report = run_precheck(mode, cwd, image_tag=image_tag, script_path=script_path)
    return emit_result(
        "success" if report["ok"] else "error",
        data=report,
        error=None if report["ok"] else "Precheck failed",
        exit_code=0 if report["ok"] else 2,
    )


def run_artifact(cwd):
    npm_cmd = resolve_command(["npm", "npm.cmd", "npm.exe"])
    if not npm_cmd:
        return {
            "ok": False,
            "error": "Required command not found: npm",
            "returncode": 127,
            "stdout": "",
            "stderr": "",
        }
    return run_command([npm_cmd, "pack"], cwd=cwd)


def run_npm_publish(cwd, dry_run):
    npm_cmd = resolve_command(["npm", "npm.cmd", "npm.exe"])
    if not npm_cmd:
        return {
            "ok": False,
            "error": "Required command not found: npm",
            "returncode": 127,
            "stdout": "",
            "stderr": "",
        }
    args = [npm_cmd, "publish", "--provenance", "--access", "public"]
    if dry_run:
        args.append("--dry-run")
    return run_command(args, cwd=cwd)


def run_docker(cwd, image_tag, push):
    docker_cmd = resolve_command(["docker", "docker.exe"])
    if not docker_cmd:
        return {
            "ok": False,
            "error": "Required command not found: docker",
            "returncode": 127,
            "stdout": "",
            "stderr": "",
        }
    build = run_command([docker_cmd, "build", "-t", image_tag, "."], cwd=cwd)
    if not build["ok"]:
        return build
    if push:
        pushed = run_command([docker_cmd, "push", image_tag], cwd=cwd)
        return pushed
    return build


def run_script(cwd, script_path, script_args):
    resolved = (cwd / script_path).resolve()
    try:
        resolved.relative_to(cwd.resolve())
    except ValueError:
        return {
            "ok": False,
            "error": "Script must be inside workspace directory",
            "returncode": 2,
            "stdout": "",
            "stderr": "",
        }

    if not resolved.exists():
        return {
            "ok": False,
            "error": f"Script file not found: {resolved}",
            "returncode": 2,
            "stdout": "",
            "stderr": "",
        }

    suffix = resolved.suffix.lower()
    if suffix == ".py":
        command = ["python", str(resolved), *script_args]
    elif suffix in {".js", ".mjs"}:
        command = ["node", str(resolved), *script_args]
    elif suffix in {".sh"}:
        command = ["bash", str(resolved), *script_args]
    elif suffix in {".ps1"}:
        command = ["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", str(resolved), *script_args]
    else:
        command = [str(resolved), *script_args]

    return run_command(command, cwd=cwd)


def resolve_report_path(cwd, report_path):
    if report_path:
        candidate = Path(report_path)
        resolved = (cwd / candidate).resolve() if not candidate.is_absolute() else candidate.resolve()
    else:
        stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        resolved = (cwd / ".deploy-reports" / f"deployment_report_{stamp}.json").resolve()

    try:
        resolved.relative_to(cwd.resolve())
    except ValueError as exc:
        raise ValueError("Report path must be inside workspace directory") from exc
    return resolved


def write_report(report_path, payload):
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
    return str(report_path)


def execute(
    mode,
    cwd,
    confirm,
    research_refs,
    allow_unofficial_research,
    environment="unspecified",
    dry_run=False,
    image_tag=None,
    push=False,
    script_path=None,
    script_args=None,
    report_path=None,
):
    started_at = utc_now()
    precheck_report = run_precheck(mode, cwd, image_tag=image_tag, script_path=script_path)
    research_validation = validate_research(mode, research_refs, allow_unofficial_research)
    confirmation_template = build_confirmation_template(mode, environment, dry_run, image_tag=image_tag, script_path=script_path)

    try:
        resolved_report_path = resolve_report_path(cwd, report_path)
    except ValueError as exc:
        return emit_result("error", error=str(exc), data=None, exit_code=2)

    report_payload = {
        "started_at": started_at,
        "ended_at": None,
        "mode": mode,
        "environment": environment,
        "dry_run": dry_run,
        "cwd": str(cwd),
        "confirmation_required": CONFIRM_TOKEN,
        "confirmation_provided": confirm,
        "confirmation_template": confirmation_template,
        "research": research_refs,
        "precheck": precheck_report,
        "execution": None,
        "status": None,
        "error": None,
    }

    if confirm != CONFIRM_TOKEN:
        report_payload["status"] = "error"
        report_payload["error"] = f"Invalid confirmation token. Use '{CONFIRM_TOKEN}' to execute."
        report_payload["ended_at"] = utc_now()
        output_path = write_report(resolved_report_path, report_payload)
        return emit_result("error", error=report_payload["error"], data={"report_path": output_path}, exit_code=2)

    if not research_validation["ok"]:
        report_payload["status"] = "error"
        report_payload["error"] = research_validation["error"]
        report_payload["ended_at"] = utc_now()
        output_path = write_report(resolved_report_path, report_payload)
        return emit_result("error", error=report_payload["error"], data={"report_path": output_path, "research": research_refs}, exit_code=2)

    if not precheck_report["ok"]:
        report_payload["status"] = "error"
        report_payload["error"] = "Precheck failed"
        report_payload["ended_at"] = utc_now()
        output_path = write_report(resolved_report_path, report_payload)
        return emit_result("error", error="Precheck failed", data={"report_path": output_path, "precheck": precheck_report}, exit_code=2)

    if mode == "artifact":
        result = run_artifact(cwd)
    elif mode == "npm":
        result = run_npm_publish(cwd, dry_run=dry_run)
    elif mode == "docker":
        if not image_tag:
            report_payload["status"] = "error"
            report_payload["error"] = "Missing --image-tag for docker mode"
            report_payload["ended_at"] = utc_now()
            output_path = write_report(resolved_report_path, report_payload)
            return emit_result("error", error=report_payload["error"], data={"report_path": output_path}, exit_code=2)
        result = run_docker(cwd, image_tag=image_tag, push=push and not dry_run)
    else:
        result = run_script(cwd, script_path=script_path, script_args=script_args or [])

    report_payload["execution"] = result
    report_payload["ended_at"] = utc_now()

    if not result["ok"]:
        report_payload["status"] = "error"
        report_payload["error"] = result["error"]
        output_path = write_report(resolved_report_path, report_payload)
        return emit_result(
            "error",
            error=result["error"],
            data={
                "report_path": output_path,
                "mode": mode,
                "dry_run": dry_run,
                "stdout": result["stdout"],
                "stderr": result["stderr"],
            },
            exit_code=result["returncode"],
        )

    report_payload["status"] = "success"
    output_path = write_report(resolved_report_path, report_payload)
    return emit_result(
        "success",
        data={
            "mode": mode,
            "dry_run": dry_run,
            "stdout": result["stdout"],
            "stderr": result["stderr"],
            "report_path": output_path,
            "confirmation_template": confirmation_template,
        },
        exit_code=0,
    )


def parse_args():
    parser = argparse.ArgumentParser(description="Universal Deploy Orchestrator")
    subparsers = parser.add_subparsers(dest="action", required=True)

    common = argparse.ArgumentParser(add_help=False)
    common.add_argument("--mode", required=True, choices=["artifact", "npm", "docker", "script"])
    common.add_argument("--cwd", default=".", help="Working directory")
    common.add_argument("--environment", default="unspecified", help="Environment label")
    common.add_argument("--image-tag", default=None, help="Docker image tag")
    common.add_argument("--script-path", default=None, help="Local script path for script mode")
    common.add_argument("--research-ref", action="append", default=[], help="Official reference URL (repeatable)")
    common.add_argument("--research-refs", default="", help="Comma-separated official reference URLs")
    common.add_argument("--allow-unofficial-research", action="store_true", help="Allow non-official refs")

    subparsers.add_parser("plan", parents=[common], help="Generate deployment plan")
    subparsers.add_parser("precheck", parents=[common], help="Run pre-deployment checks")

    confirm_template_parser = subparsers.add_parser("confirm-template", parents=[common], help="Render confirmation template")
    confirm_template_parser.add_argument("--dry-run", action="store_true", help="Dry run mode")

    execute_parser = subparsers.add_parser("execute", parents=[common], help="Execute deployment")
    execute_parser.add_argument("--confirm", required=True, help=f"Confirmation token ({CONFIRM_TOKEN})")
    execute_parser.add_argument("--dry-run", action="store_true", help="Execute in dry-run mode")
    execute_parser.add_argument("--push", action="store_true", help="For docker mode, push after build")
    execute_parser.add_argument("--arg", action="append", default=[], help="Script argument (repeatable)")
    execute_parser.add_argument("--report-path", default=None, help="Report path relative to cwd")

    args = parser.parse_args()
    return args


def main():
    args = parse_args()
    cwd = Path(args.cwd).resolve()
    if not cwd.exists() or not cwd.is_dir():
        return emit_result("error", error=f"Invalid cwd: {cwd}", data=None, exit_code=2)

    research_refs = normalize_research_refs(args.mode, args.research_ref, args.research_refs)

    if args.action == "plan":
        plan = build_plan(
            args.mode,
            cwd=cwd,
            environment=args.environment,
            dry_run=False,
            image_tag=args.image_tag,
            script_path=args.script_path,
            research=research_refs,
        )
        return emit_result("success", data=plan, exit_code=0)

    if args.action == "precheck":
        research_validation = validate_research(args.mode, research_refs, args.allow_unofficial_research)
        if not research_validation["ok"]:
            return emit_result("error", error=research_validation["error"], data=research_validation["data"], exit_code=2)
        return emit_precheck(args.mode, cwd=cwd, image_tag=args.image_tag, script_path=args.script_path)

    if args.action == "confirm-template":
        template = build_confirmation_template(
            args.mode,
            environment=args.environment,
            dry_run=args.dry_run,
            image_tag=args.image_tag,
            script_path=args.script_path,
        )
        return emit_result("success", data=template, exit_code=0)

    return execute(
        args.mode,
        cwd=cwd,
        confirm=args.confirm,
        research_refs=research_refs,
        allow_unofficial_research=args.allow_unofficial_research,
        environment=args.environment,
        dry_run=args.dry_run,
        image_tag=args.image_tag,
        push=args.push,
        script_path=args.script_path,
        script_args=args.arg,
        report_path=args.report_path,
    )


if __name__ == "__main__":
    sys.exit(main())
