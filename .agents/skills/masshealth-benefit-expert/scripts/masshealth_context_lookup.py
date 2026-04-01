#!/usr/bin/env python3
"""
MassHealth repo context lookup.

Print the smallest relevant file set for a MassHealth feature area so an agent
can navigate this codebase without loading unrelated files.
"""

from __future__ import annotations

import argparse
import sys


TOPICS = {
    "eligibility": {
        "summary": "Deterministic eligibility rules, application checks, and FPL-driven routing.",
        "files": [
            ("lib/eligibility-engine.ts", "Generic screener and core MassHealth eligibility entry."),
            ("lib/masshealth/aca3-eligibility-engine.ts", "ACA-3 deterministic rules."),
            ("lib/masshealth/aca3ap-eligibility-engine.ts", "ACA-3-AP deterministic rules."),
            ("lib/masshealth/aca3-requirements.ts", "ACA-3 document and rule requirements."),
            ("lib/masshealth/aca3ap-requirements.ts", "ACA-3-AP document and rule requirements."),
            ("lib/masshealth/application-checks.ts", "Validation and consistency checks."),
            ("lib/masshealth/application-types.ts", "Application type routing and labels."),
            ("lib/masshealth/__tests__", "Nearest tests for rule changes."),
        ],
    },
    "chat": {
        "summary": "MassHealth chat, intake, advisor, and form-assistant flows.",
        "files": [
            ("app/api/chat/masshealth/route.ts", "Primary API route and mode orchestration."),
            ("lib/masshealth/chat-knowledge.ts", "Prompt builders, FAQs, links, and out-of-scope rules."),
            ("lib/masshealth/fact-extraction.ts", "LLM-based fact extraction from chat history."),
            ("lib/masshealth/form-field-extraction.ts", "Form assistant structured extraction."),
            ("lib/masshealth/household-relationships.ts", "Household relationship inference."),
            ("components/chat/masshealth-chat-widget.tsx", "Primary chat UI."),
            ("components/chat/__tests__/masshealth-chat-widget.test.tsx", "Nearest UI tests."),
        ],
    },
    "appeals": {
        "summary": "Appeal analysis, document extraction, and prompt contracts.",
        "files": [
            ("app/api/appeals/analyze/route.ts", "Appeal analysis endpoint."),
            ("app/api/appeals/extract-document/route.ts", "Denial-letter extraction endpoint."),
            ("lib/appeals/prompts.ts", "JSON-only appeal prompt contract."),
            ("lib/appeals/constants.ts", "Denial reasons and limits."),
            ("lib/appeals/copy.ts", "Localized copy and disclaimers."),
            ("components/appeals/DenialInputForm.tsx", "Appeal intake UI."),
            ("components/appeals/AppealResultView.tsx", "Appeal result UI."),
        ],
    },
    "benefit-stack": {
        "summary": "Cross-program benefit evaluation, ranking, and application bundles.",
        "files": [
            ("lib/benefit-orchestration/orchestrator.ts", "Top-level benefit orchestration engine."),
            ("lib/benefit-orchestration/programs/masshealth.ts", "MassHealth program evaluator."),
            ("lib/benefit-orchestration/programs", "Other statewide benefit evaluators."),
            ("lib/benefit-orchestration/types.ts", "Shared profile and result types."),
            ("app/api/benefit-orchestration/evaluate/route.ts", "Evaluation API route."),
            ("app/api/benefit-orchestration/profile/route.ts", "Profile persistence API route."),
            ("components/benefit-orchestration", "Wizard and results UI."),
        ],
    },
    "rag": {
        "summary": "Policy ingest, embedding, retrieval, and prompt formatting.",
        "files": [
            ("lib/rag/ingest.ts", "Fetch, chunk, embed, and upsert policy sources."),
            ("lib/rag/retrieve.ts", "pgvector similarity retrieval and prompt formatting."),
            ("lib/rag/embed.ts", "Embedding client and vector conversion."),
            ("lib/rag/constants.ts", "Chunking and embedding defaults."),
            ("app/api/rag/ingest/route.ts", "Ingest API route."),
            ("lib/rag/__tests__", "Nearest retrieval and ingest tests."),
        ],
    },
    "documents": {
        "summary": "MassHealth document extraction and PDF payload mapping.",
        "files": [
            ("lib/masshealth/extract-auto-client.ts", "Auto extraction client."),
            ("lib/masshealth/extract-workflow-client.ts", "Workflow extraction client."),
            ("lib/masshealth/ollama-client.ts", "Ollama call wrapper."),
            ("lib/pdf/masshealth-aca.ts", "MassHealth PDF domain mapping."),
            ("lib/pdf/masshealth-aca-payload.ts", "PDF payload construction."),
            ("lib/masshealth/form-sections.ts", "Form section schema."),
            ("lib/pdf/__tests__", "Nearest PDF and extraction tests."),
        ],
    },
    "i18n": {
        "summary": "Supported-language behavior for MassHealth UX.",
        "files": [
            ("lib/masshealth/chat-knowledge.ts", "Localized greetings and out-of-scope copy."),
            ("lib/appeals/copy.ts", "Localized appeal page copy."),
            ("lib/i18n/languages.ts", "Supported language set."),
            ("app/api/chat/masshealth/route.ts", "Language resolution in chat modes."),
        ],
    },
}


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Look up MassHealth repo context by topic.")
    parser.add_argument("--topic", help="Topic to inspect.")
    parser.add_argument("--list", action="store_true", help="List supported topics.")
    return parser


def print_topics() -> None:
    print("Supported topics:")
    for topic in sorted(TOPICS):
        print(f"- {topic}: {TOPICS[topic]['summary']}")


def print_topic(topic: str) -> int:
    item = TOPICS.get(topic)
    if item is None:
        print(f"Unknown topic: {topic}", file=sys.stderr)
        print_topics()
        return 1

    print(f"Topic: {topic}")
    print(f"Summary: {item['summary']}")
    print("Files:")
    for path, note in item["files"]:
        print(f"- {path}: {note}")
    return 0


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()

    if args.list:
        print_topics()
        return 0

    if not args.topic:
        parser.error("provide --topic or use --list")

    return print_topic(args.topic)


if __name__ == "__main__":
    raise SystemExit(main())
