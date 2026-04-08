# Changelog

All notable changes to this project will be documented in this file.

## [3.2.0] - 2026-04-08

### Added

- Research-gated deploy execution in `deploy_orchestrator.py` (`--research-ref` required).
- Confirmation template command (`confirm-template`) by deploy mode.
- Automatic structured deployment report generation in `.deploy-reports/deployment_report_*.json`.
- Cross-CLI activation compatibility layer:
  - `wrappers/activation-profiles/profiles.json`
  - `wrappers/activation-profiles/compose_prompt.mjs`
- New compatibility guide: `COMPATIBILITY.md`.

### Changed

- `ai.ps1` and `ai.sh` now support activation profile syntax:
  - `"/activation" "prompt" --flagcli`
  - `--activation`
  - `--list-activations`
  - `--cli-cmd` for custom CLIs.

## [3.1.0] - 2026-04-08

### Added

- Deploy specialist skill (`wrappers/gemini-skills/deploy-specialist/SKILL.md`).
- Deploy core tool (`core-scripts/deploy/deploy_orchestrator.py`).
- Prompt kits by domain (`prompts/`).
- Deploy specialist guide (`DEPLOY_AGENT.md`).
- GitHub governance files (`SECURITY.md`, Dependabot, templates).
- Additional workflows for security, manual deploy, and release.

### Changed

- Tool contracts now include `deploy_orchestrator`.
- Documentation updated across README, setup guide, commands catalog and system master doc.

## [3.0.0] - 2026-04-08

### Added

- Contract-driven tools manifest and schema.
- Shared runtime for wrappers.
- Setup improvements (doctor, non-interactive profiles, PATH configuration).
- CI matrix and smoke/contract validation automation.
