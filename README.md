# AI Automated Template

This is a blank starter project with basic AI tooling setup. Clone this repo and follow the instructions to get started with AI-enabled development. This includes:
- Using autonomous agents safely through sandbox environments
- Running multiple agents simultaneously
- Automatically triggering agents to handle tasks
- Assistance in reviewing changes
- Periodic testing and codebase maintenance

The goal is to close the loop with AI as much as possible to speed development, while still allowing human intervention to steer when needed.

This template is intentionally generic. It provides the wiring to get started, but as your project develops you'll want to customize it for your specific needs.

---

# Strategy

The core idea is to use GitHub as a coordination backbone. Instead of a single super-agent, smaller agents pick up and drop off work on a repo, just like a team of people would. This makes the automation easy to reason about, provides visibility into operation, and provides clear intervention points for customization or manual steering.

The template is organized around five components:

## Execution Environments
Isolated, sandboxed environments where AI agents can write and run code safely. Agents need unrestricted access to tools and the filesystem — isolation is what makes that safe.

## Task Coordination
GitHub issues and PRs are the interface between humans and agents. Issues define work; PRs deliver it. Every task has a clear paper trail and a natural review point.

## Agent Triggers
Three ways to invoke an agent:
- **Manual** — a human kicks off an agent directly
- **Event-driven** — a new issue automatically spawns an agent to handle it
- **Scheduled** — periodic agents run on a timer (e.g. nightly test runs, maintenance)

## Quality Gates
Automated checkpoints before work lands: PR review, test runs, and merge criteria. Agents should not be able to merge their own work without passing these gates.

## Project Context
How agents understand the project they're working on — conventions, architecture decisions, coding standards. Without shared context, every agent starts cold and makes inconsistent choices. This is the most project-specific component and the one you'll customize most as your project grows.

## Something about automatic issue creation to close the loop

TODO: Describe the overall loop operation


---

# How it works

The template ships with the following files and configurations:

## GitHub Actions Workflows
- **`agent-dispatch.yml`** — triggered manually via `workflow_dispatch`. Takes an issue number as input, spins up a Codespace, and runs Claude Code against it.
- **`agent-trigger.yml`** — triggered when an issue is labeled `agent`. Automatically spins up a Codespace and runs Claude Code against the labeled issue.
- **`scheduled-tasks.yml`** — runs on a cron schedule. Invokes Claude Code to check for test failures, stale issues, or other maintenance tasks and files issues for anything it finds.
- **`pr-review.yml`** — triggered on PR open. Runs Claude Code to review the diff and posts findings as PR comments.
- **`auto-merge.yml`** — triggered when a PR is approved. Auto-merges if all CI checks pass and the PR is labeled `auto-merge`.

## Codespace Configuration
A `.devcontainer/` config that pre-installs Claude Code and the GitHub CLI so agents have everything they need when the environment starts.

## CLAUDE.md
A root-level `CLAUDE.md` that gives agents their baseline instructions — things like branch naming, PR workflow, and how to interact with GitHub. This is the file you'll edit most as your project evolves.

## Branch Protection
A GitHub branch protection configuration requiring CI to pass and at least one approval before any PR can merge to `main`.

---

# Setup
---

# Human-in-the-loop

Automation handles routine work; humans steer and override. The template is designed with explicit points where human input is expected:

- **Issue creation** — humans (or external systems) define what needs to be done
- **PR review** — non-trivial changes require human approval before merging
- **Context maintenance** — humans keep the project context accurate, which guides all agent behavior

The goal is not to remove humans from the process, but to reserve human attention for decisions that actually need it.
