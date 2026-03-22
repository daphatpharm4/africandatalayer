#!/usr/bin/env python3
"""Convert Agency-style Markdown agents into Codex skill folders.

This script is designed for repositories like:
https://github.com/msitarzewski/agency-agents

Given a local checkout of the source repo, it discovers agent Markdown files,
creates one Codex skill directory per agent, and writes:

- SKILL.md
- agents/openai.yaml
- references/original-agent.md

The conversion is intentionally conservative:
- Keep the original agent verbatim under references/
- Generate a concise Codex-oriented SKILL.md around extracted sections
- Avoid external dependencies
"""

from __future__ import annotations

import argparse
import json
import re
import shutil
import unicodedata
from dataclasses import dataclass
from pathlib import Path


EXCLUDED_DIRS = {
    ".git",
    ".github",
    "examples",
    "integrations",
    "scripts",
    "assets",
    "agents",
    "node_modules",
}

SKIP_FILENAMES = {
    "README.md",
    "CONTRIBUTING.md",
    "LICENSE.md",
    "LICENSE",
    "CODE_OF_CONDUCT.md",
    "SECURITY.md",
    "CHANGELOG.md",
}

FRONTMATTER_RE = re.compile(r"\A---\s*\n(.*?)\n---\s*\n?", re.DOTALL)
HEADING_RE = re.compile(r"^(#{1,6})\s+(.*)$")


@dataclass
class AgentFile:
    path: Path
    relative_path: Path
    metadata: dict[str, str]
    body: str


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Convert agency-agents Markdown files into Codex skills."
    )
    parser.add_argument(
        "--source",
        required=True,
        type=Path,
        help="Path to a local checkout of agency-agents.",
    )
    parser.add_argument(
        "--output",
        required=True,
        type=Path,
        help="Directory where Codex skill folders will be created.",
    )
    parser.add_argument(
        "--overwrite",
        action="store_true",
        help="Overwrite existing generated skill directories.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print the planned work without writing files.",
    )
    parser.add_argument(
        "--report",
        type=Path,
        help="Optional path for a JSON conversion report. Defaults to <output>/conversion-report.json.",
    )
    return parser.parse_args()


def slugify(value: str) -> str:
    value = value.replace("&", " and ")
    value = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii")
    value = value.lower()
    value = re.sub(r"[^a-z0-9]+", "-", value)
    value = re.sub(r"-{2,}", "-", value).strip("-")
    return value or "unnamed-skill"


def normalize_text(value: str) -> str:
    value = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii")
    value = value.lower()
    value = re.sub(r"[^a-z0-9]+", " ", value)
    return " ".join(value.split())


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8", errors="replace")


def split_frontmatter(text: str) -> tuple[dict[str, str], str]:
    match = FRONTMATTER_RE.match(text)
    if not match:
        return {}, text

    frontmatter = {}
    for raw_line in match.group(1).splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or ":" not in line:
            continue
        key, value = line.split(":", 1)
        key = key.strip()
        value = value.strip()
        if value.startswith(("'", '"')) and value.endswith(("'", '"')) and len(value) >= 2:
            value = value[1:-1]
        frontmatter[key] = value
    return frontmatter, text[match.end() :]


def looks_like_agent_file(path: Path, metadata: dict[str, str], body: str) -> bool:
    if path.name in SKIP_FILENAMES:
        return False

    parts = set(path.parts)
    if parts & EXCLUDED_DIRS:
        return False

    if metadata.get("name") and metadata.get("description"):
        return True

    normalized = normalize_text(body[:5000])
    return "core mission" in normalized or "critical rules" in normalized


def discover_agents(source_root: Path) -> list[AgentFile]:
    agents: list[AgentFile] = []
    for path in sorted(source_root.rglob("*.md")):
        text = read_text(path)
        metadata, body = split_frontmatter(text)
        relative_path = path.relative_to(source_root)
        if not looks_like_agent_file(relative_path, metadata, body):
            continue
        agents.append(
            AgentFile(
                path=path,
                relative_path=relative_path,
                metadata=metadata,
                body=body.strip(),
            )
        )
    return agents


def extract_section(markdown: str, *keywords: str) -> str:
    lines = markdown.splitlines()
    headings: list[tuple[int, int, str]] = []
    for index, line in enumerate(lines):
        heading_match = HEADING_RE.match(line)
        if heading_match:
            headings.append((index, len(heading_match.group(1)), heading_match.group(2).strip()))

    normalized_keywords = [normalize_text(keyword) for keyword in keywords]
    for position, (start_index, level, heading) in enumerate(headings):
        normalized_heading = normalize_text(heading)
        if all(keyword in normalized_heading for keyword in normalized_keywords):
            end_index = len(lines)
            for next_start, next_level, _ in headings[position + 1 :]:
                if next_level <= level:
                    end_index = next_start
                    break
            return "\n".join(lines[start_index + 1 : end_index]).strip()
    return ""


def strip_code_blocks(markdown: str) -> str:
    return re.sub(r"```.*?```", "", markdown, flags=re.DOTALL)


def trim_markdown(markdown: str, max_lines: int = 18, max_chars: int = 2400) -> str:
    cleaned = strip_code_blocks(markdown).strip()
    if not cleaned:
        return ""

    kept: list[str] = []
    blank_pending = False
    for raw_line in cleaned.splitlines():
        line = raw_line.rstrip()
        if not line.strip():
            if kept and not blank_pending:
                kept.append("")
            blank_pending = True
            continue

        blank_pending = False
        kept.append(line)
        if len(kept) >= max_lines:
            break

    text = "\n".join(kept).strip()
    if len(text) > max_chars:
        text = text[: max_chars - 3].rstrip() + "..."
    return text


def first_sentence(text: str) -> str:
    compact = " ".join(text.split())
    if not compact:
        return ""
    match = re.match(r"(.+?[.!?])(?:\s|$)", compact)
    return match.group(1) if match else compact


def ensure_sentence_end(text: str) -> str:
    text = text.strip()
    if not text:
        return text
    if text[-1] in ".!?":
        return text
    return text + "."


def truncate_words(text: str, limit: int) -> str:
    text = " ".join(text.split())
    if len(text) <= limit:
        return text
    shortened = text[: limit - 3].rstrip()
    if " " in shortened:
        shortened = shortened.rsplit(" ", 1)[0]
    return shortened.rstrip() + "..."


def make_skill_name(agent: AgentFile, used_names: set[str]) -> str:
    raw_name = agent.metadata.get("name") or agent.path.stem
    base = slugify(raw_name)
    if base not in used_names:
        used_names.add(base)
        return base

    prefixed = slugify(f"{agent.relative_path.parts[0]}-{raw_name}")
    if prefixed not in used_names:
        used_names.add(prefixed)
        return prefixed

    counter = 2
    while True:
        candidate = f"{prefixed}-{counter}"
        if candidate not in used_names:
            used_names.add(candidate)
            return candidate
        counter += 1


def make_display_name(agent: AgentFile) -> str:
    return (agent.metadata.get("name") or agent.path.stem).strip()


def make_description(agent: AgentFile) -> str:
    source = " ".join((agent.metadata.get("description") or "").split())
    if not source:
        title = make_display_name(agent)
        source = f"Specialist workflow for {title} tasks."

    if "use when" in source.lower():
        return source

    return (
        f"{ensure_sentence_end(source)} Use when Codex needs this specialist perspective, workflow, "
        f"or review style for related tasks in the current project."
    )


def make_short_description(agent: AgentFile) -> str:
    source = " ".join((agent.metadata.get("description") or make_display_name(agent)).split())
    source = source.rstrip(".")
    if len(source) <= 64:
        return source
    sentence = first_sentence(source)
    if sentence and len(sentence) <= 64:
        return sentence.rstrip(".")
    return truncate_words(source, 64)


def make_default_prompt(skill_name: str, agent: AgentFile) -> str:
    title = make_display_name(agent)
    return f"Use ${skill_name} to handle {title.lower()} work in this project."


def build_skill_body(skill_name: str, agent: AgentFile) -> str:
    display_name = make_display_name(agent)
    overview = ensure_sentence_end(first_sentence(agent.metadata.get("description", ""))) or (
        f"Apply the original {display_name} Agency workflow to the current task."
    )
    core_mission = trim_markdown(extract_section(agent.body, "core", "mission"))
    critical_rules = trim_markdown(extract_section(agent.body, "critical", "rules"))
    communication = trim_markdown(extract_section(agent.body, "communication", "style"))

    lines: list[str] = [
        "---",
        f"name: {skill_name}",
        f"description: {make_description(agent)}",
        "---",
        "",
        f"# {display_name}",
        "",
        "## Overview",
        "",
        overview,
        "",
        (
            "Use this skill as the Codex-native version of the original Agency agent. "
            "Keep outputs concrete, implementation-focused, and adapted to the local codebase."
        ),
    ]

    if core_mission:
        lines.extend(
            [
                "",
                "## Workflow",
                "",
                core_mission,
            ]
        )
    else:
        lines.extend(
            [
                "",
                "## Workflow",
                "",
                "1. Read the task and identify the domain-specific constraints.",
                "2. Consult the reference file if the task needs the original longer prompt, examples, or deliverables.",
                "3. Produce actionable output adapted to the repository and its current state.",
            ]
        )

    if critical_rules:
        lines.extend(
            [
                "",
                "## Rules",
                "",
                critical_rules,
            ]
        )

    if communication:
        lines.extend(
            [
                "",
                "## Communication",
                "",
                communication,
            ]
        )

    lines.extend(
        [
            "",
            "## Reference",
            "",
            (
                "Read [references/original-agent.md](references/original-agent.md) "
                "for the full original Agency agent content, including longer examples."
            ),
            "",
            f"Original source path: `{agent.relative_path.as_posix()}`",
        ]
    )

    return "\n".join(lines).strip() + "\n"


def yaml_quote(value: str) -> str:
    return json.dumps(value, ensure_ascii=False)


def build_openai_yaml(skill_name: str, agent: AgentFile) -> str:
    display_name = make_display_name(agent)
    short_description = make_short_description(agent)
    default_prompt = make_default_prompt(skill_name, agent)
    return "\n".join(
        [
            "interface:",
            f"  display_name: {yaml_quote(display_name)}",
            f"  short_description: {yaml_quote(short_description)}",
            f"  default_prompt: {yaml_quote(default_prompt)}",
            "",
        ]
    )


def ensure_directory(path: Path, overwrite: bool) -> None:
    if path.exists():
        if not overwrite:
            raise FileExistsError(f"{path} already exists. Re-run with --overwrite to replace it.")
        shutil.rmtree(path)
    path.mkdir(parents=True, exist_ok=True)


def write_skill(output_root: Path, skill_name: str, agent: AgentFile, overwrite: bool) -> dict[str, str]:
    skill_dir = output_root / skill_name
    ensure_directory(skill_dir, overwrite=overwrite)
    (skill_dir / "agents").mkdir(parents=True, exist_ok=True)
    (skill_dir / "references").mkdir(parents=True, exist_ok=True)

    (skill_dir / "SKILL.md").write_text(build_skill_body(skill_name, agent), encoding="utf-8")
    (skill_dir / "agents" / "openai.yaml").write_text(
        build_openai_yaml(skill_name, agent),
        encoding="utf-8",
    )
    (skill_dir / "references" / "original-agent.md").write_text(
        agent.path.read_text(encoding="utf-8", errors="replace"),
        encoding="utf-8",
    )

    return {
        "skill_name": skill_name,
        "source": agent.relative_path.as_posix(),
        "output_dir": str(skill_dir),
    }


def main() -> int:
    args = parse_args()
    source_root = args.source.resolve()
    output_root = args.output.resolve()
    report_path = args.report.resolve() if args.report else output_root / "conversion-report.json"

    if not source_root.exists():
        raise SystemExit(f"Source path does not exist: {source_root}")

    agents = discover_agents(source_root)
    if not agents:
        raise SystemExit(f"No agent Markdown files were found under: {source_root}")

    used_names: set[str] = set()
    planned: list[tuple[str, AgentFile]] = []
    for agent in agents:
        planned.append((make_skill_name(agent, used_names), agent))

    if args.dry_run:
        print(f"Discovered {len(planned)} agent files under {source_root}")
        for skill_name, agent in planned:
            print(f"- {skill_name}: {agent.relative_path.as_posix()}")
        return 0

    output_root.mkdir(parents=True, exist_ok=True)

    report: list[dict[str, str]] = []
    for skill_name, agent in planned:
        report.append(write_skill(output_root, skill_name, agent, overwrite=args.overwrite))

    report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")

    print(f"Converted {len(report)} agents into Codex skills.")
    print(f"Output directory: {output_root}")
    print(f"Report: {report_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
