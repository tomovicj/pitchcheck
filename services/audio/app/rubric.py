"""Rubric helpers shared by the pitch, the deck and the alignment check.

A rubric maps a criterion name to five level descriptions, from level 4 down to level 0. Gemma gives
the level where the description is a judgement; code gives it where the description is a count or
a share, because Gemma did not apply numeric limits reliably when asked to.
"""

# Topics a pitch is expected to explain, and what each one means. The rubrics check that they are
# covered, not whether they are good.
PITCH_TOPICS = {
    "problem": "what hurts, and for whom",
    "solution": "what the product does",
    "customer or market": "who buys it, or how many of them there are",
    "alternatives": "competitors, or what people do today instead",
    "business model": "how it makes money",
    "team": "who builds it",
}
# For the prompts: Gemma mixed up problem and solution when it was given the names alone
TOPIC_GUIDE = "; ".join(f"{name} ({meaning})" for name, meaning in PITCH_TOPICS.items())


TOPIC_CRITERION = "Topic coverage"
TOPIC_LEVELS = [
    "every expected topic is explained",
    "one expected topic is missing",
    "two or three expected topics are missing",
    "more than three expected topics are missing",
    "no expected topic is explained",
]


def rate_topics(missing: list[str]) -> dict:
    """The topic coverage criterion, from the expected topics Gemma found nowhere; limits as in TOPIC_LEVELS."""
    level = 4 if not missing else 3 if len(missing) == 1 else 2 if len(missing) <= 3 else 0 if len(missing) == len(PITCH_TOPICS) else 1
    reason = f"Not explained: {', '.join(missing)}." if missing else "Every expected topic is explained."
    return {"name": TOPIC_CRITERION, "reason": reason, "level": level}


def describe(rubric: dict[str, list[str]], names: list[str]) -> str:
    """The named criteria with their level descriptions, as prompt text."""
    lines = []
    for name in names:
        lines.append(f"- {name}")
        lines.extend(f"  {4 - i}: {description}" for i, description in enumerate(rubric[name]))
    return "\n".join(lines)


def gemma_levels(criteria: object, names: list[str]) -> dict[str, dict]:
    """The entries of Gemma's reply that name one of the criteria and carry a level from 0 to 4."""
    rated = {}
    for c in criteria if isinstance(criteria, list) else []:
        name = c.get("name") if isinstance(c, dict) else None
        if isinstance(name, str) and name in names and c.get("level") in range(5):
            rated[name] = {**c, "level": int(c["level"])}
    return rated


def total(rubric: dict[str, list[str]], rated: dict[str, dict]) -> tuple[list[dict], int | None]:
    """The rated criteria in rubric order and their 0-100 score in steps of 5.

    Equal weights; a criterion that was not rated drops out of the score instead of counting as 0.
    """
    ordered = [rated[name] for name in rubric if name in rated]
    if not ordered:
        return [], None
    share = sum(c["level"] for c in ordered) / (4 * len(ordered))
    return ordered, round(share * 20) * 5


def share_levels(problem: str) -> list[str]:
    """Level descriptions for a criterion rated by the share of slides that have a problem."""
    return [
        f"no slide {problem}",
        f"up to 15% of the slides {problem}",
        f"up to 35% of the slides {problem}",
        f"up to 60% of the slides {problem}",
        f"more than 60% of the slides {problem}",
    ]


def level_for_share(share: float) -> int:
    """The level for a share of slides with a problem; limits as in share_levels()."""
    return 4 if share == 0 else 3 if share <= 0.15 else 2 if share <= 0.35 else 1 if share <= 0.6 else 0


def split_topics(topic_lists: list[object]) -> tuple[list[str], list[str]]:
    """The expected topics that appear in some list Gemma returned, and the ones that appear in none."""
    found = set()
    for topics in topic_lists:
        if isinstance(topics, list):
            # Gemma sometimes returns the name with its meaning in brackets
            found.update(t.split("(")[0].strip().lower() for t in topics if isinstance(t, str))
    # "customer" or "market" alone counts for "customer or market"
    covered = [t for t in PITCH_TOPICS if found & {t, *t.split(" or ")}]
    return covered, [t for t in PITCH_TOPICS if t not in covered]


def strings(value: object, limit: int) -> list[str]:
    """Gemma's list of strings, without empty or non-string items, at most limit long."""
    if not isinstance(value, list):
        return []
    return [v.strip() for v in value if isinstance(v, str) and v.strip()][:limit]
