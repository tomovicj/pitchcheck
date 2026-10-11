"""Rubric helpers shared by the pitch, the deck and the alignment check.

A rubric is a set of criteria in groups. Each criterion has five level descriptions, from level 4 down
to level 0, and every level is a count, a share or a measurement, so code gives it. Gemma supplies what
is counted: it listens and reads, and it labels each statement it heard or read with the thing a pitch
is expected to say that the statement says, or with none. Gemma did not apply numeric limits reliably
when asked to, and a checklist of yes-or-no findings is steadier than a level given from an impression
(CheckEval, Lee et al., EMNLP 2025, arXiv:2403.18771).

The standards are Y Combinator's published advice to founders (SOURCES), read on 11 October 2026. The
limits that turn a standard into levels are this team's choice unless a comment says otherwise.
"""

import json
import os
import re
from collections.abc import Callable
from typing import NamedTuple

# In the setup of every result, so that a page can tell a service that rates by an older rubric
RUBRIC_VERSION = 2

# Who a criterion's standard is quoted from: name and title, and where it was read
SOURCES = {
    "seibel": ("Michael Seibel, How to Pitch Your Company", "https://www.ycombinator.com/library/4b-how-to-pitch-your-company"),
    "ralston": ("Geoff Ralston, A Guide to Demo Day Presentations", "https://www.ycombinator.com/blog/guide-to-demo-day-pitches"),
    "harris": ("Aaron Harris, How to build your seed round pitch deck", "https://www.ycombinator.com/library/2u-how-to-build-your-seed-round-pitch-deck"),
    "hale": ("Kevin Hale, How to design a better pitch deck", "https://www.ycombinator.com/library/4T-how-to-design-a-better-pitch-deck"),
    # Not Y Combinator: where its guides give no limit, or do not name the criterion
    "laske": ("Laske and DiGennaro Reed (2024), one study, in English", "https://doi.org/10.1002/jaba.1093"),
    "wcag": ("WCAG 2.2, written for the web", "https://www.w3.org/TR/WCAG22/#contrast-minimum"),
    "convention": ("A convention of this rubric; Y Combinator's guides do not name it", None),
}


class Criterion(NamedTuple):
    """One line of a rubric: its group, its levels from 4 down to 0, and the standard it rests on."""

    group: str
    levels: list[str]
    quote: str
    source: str
    weight: int = 1


# What a pitch and its deck are expected to say, and what each one means: the questions Y Combinator
# tells founders to answer (Seibel's seven, with the problem and the product from Ralston's outline and
# Harris's deck template). The rubrics check that each is said, not whether it is good. An event with
# its own list sets PITCH_TOPICS to a JSON object of name to meaning,
# e.g. {"problem": "what hurts, and for whom", "go-to-market": "how it reaches buyers"}.
PITCH_TOPICS: dict[str, str] = {
    name.strip().lower(): meaning
    for name, meaning in (
        json.loads(os.getenv("PITCH_TOPICS") or "null")
        or {
            "problem": "says what goes wrong today, and for whom",
            "solution": "says how the product works or what it does for its user",
            "market": "says who the customers are, how many of them there are, or how much they spend",
            "traction": "says what the team has done so far: what is built, launched, sold or tested, and with what result",
            "unique insight": "says what the team knows or does that others do not: why this works, why now, "
                              "or why it beats what people use today",
            "business model": "says how it makes money: who pays, how much, and for what",
            "team": "says who the founders are or why they fit this problem",
            "ask": "says what the team wants from the audience: an investment, a pilot, a sign-up, a next step",
        }
    ).items()
}
# Rated on its own, because where it is said matters as much as that it is said
OPENING = "what it does"
OPENING_MEANING = "names the company or the product and says in one sentence what it makes, and for whom"
# Explained only by a statement that carries a number: "Make the numbers clear and meaningful" (Harris)
NUMBER_TOPICS = [topic for topic in ("market", "traction") if topic in PITCH_TOPICS]
CHECKLIST = {OPENING: OPENING_MEANING, **PITCH_TOPICS}
# For the prompt: Gemma mixed up problem and solution when it was given the names alone
CHECKLIST_GUIDE = "\n".join(f"- {name}: {meaning}" for name, meaning in CHECKLIST.items())

TOPIC_CRITERION = "Topic coverage"
TOPIC_LEVELS = [
    "every expected topic is explained",
    "up to one expected topic in six is missing",
    "up to a third of the expected topics are missing",
    "up to half of the expected topics are missing",
    "more than half of the expected topics are missing",
]
NUMBERS_CRITERION = "Numbers"
NUMBER_LEVELS = [
    f"{' and '.join(NUMBER_TOPICS) or 'each claim'} stated with a number",
    "most of them stated with a number",
    "half of them stated with a number",
    "fewer than half of them stated with a number",
    "none of them stated with a number",
]
PLAIN_CRITERION = "Plain language"

# A figure, or a number as a word, which is how Gemma writes down what it heard ("around fifty decks")
NUMBER = re.compile(
    r"\d|\b(?:two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|"
    r"seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|"
    r"million|billion|trillion|dozen|half|percent)\b",
    re.IGNORECASE,
)
# Marketing and jargon words. Y Combinator tells founders to "eliminate jargon, acronyms, marketing speak,
# and any ambiguous terms such as 'platform'" (Seibel), and gives "a next generation, AI-based resolver of
# grocery needs" as the unclear way to say "we deliver groceries" (Ralston). The list itself is this
# team's: English only, and short, so that it rarely marks an honest word.
BUZZWORD = re.compile(
    r"\b(?:platforms?|next[- ]generation|revolutionar\w+|revolutioni[sz]\w+|disrupt\w*|synerg\w+|leverag\w+|"
    r"cutting[- ]edge|state[- ]of[- ]the[- ]art|world[- ]class|best[- ]in[- ]class|game[- ]chang\w+|innovative|"
    r"seamless\w*|holistic\w*|paradigm\w*|ecosystems?|turnkey|bleeding[- ]edge|ai[- ](?:powered|driven|based)|"
    r"groundbreaking|unparalleled|empower\w*|one[- ]stop|all[- ]in[- ]one)\b",
    re.IGNORECASE,
)


def buzzwords(text: str) -> list[str]:
    """The marketing and jargon words in a text, in order, repeated each time they are used."""
    return [match.group(0).lower() for match in BUZZWORD.finditer(text)]


Ask = Callable[..., tuple[dict | None, str]]

# Statements Gemma labels in one call: its reply has an entry for each and must fit in the output limit
STATEMENTS_PER_CALL = 40
# Statements shown for one item of the checklist
QUOTED_PER_ITEM = 2

# Gemma gives each statement a label. Asked the other way round, for the statements that say each item,
# the checklist came back empty for all nine, on a pitch and a deck that say most of them (Kaggle T4,
# 11 October 2026). That prompt showed the reply's shape with empty lists; the reply itself was not
# kept, so whether Gemma gave the shape back is a guess. Here the shape cannot pass for an answer, the
# replies are kept, and the question is the kind Gemma answered sensibly before, when it named the
# topics of each segment.
LABEL_PROMPT = """You are sorting the statements of a {kind} by what each one tells the audience. Sort only; do not judge the business idea.

{heard}. Each statement has a number in brackets:
{statements}

Give every statement one label: the line below that describes it, or "none".
{checklist}
- none: a greeting, a thank-you, a question, a bare heading such as "Our team", or a statement that fits no line above

A statement gets a label for what it says itself, not for what the statements around it say. When it fits two labels, give the one it says most directly.

Reply with only a JSON object that gives each statement number its label, in this shape:
{{"{first}": "<label>", ...and so on for every statement up to "{last}": "<label>"}}"""


def label_of(value: object) -> str | None:
    """The item of CHECKLIST a label names; None for "none" and for anything else Gemma wrote."""
    # Gemma sometimes gives the name with its meaning after a colon or in brackets
    name = re.split(r"[:(]", str(value))[0].strip(" \"'<>.").lower()
    return name if name in CHECKLIST else None


def run_checklist(ask: Ask, groups: list[tuple[str, dict, list[str]]], **wording: str) -> tuple[list[dict] | None, list]:
    """Ask Gemma to label each statement with the item of CHECKLIST it says, and turn the labels into a checklist.

    groups holds, for each segment of speech or each slide, a heading, where it is ({"at_s": seconds} or
    {"slide": number}) and its statements as Gemma heard or read them. What counts for an item is always
    one of those statements, never words made up for the answer.

    The checklist has a line for each item: whether a statement says it, the statements, and the place of
    the first. For a topic that needs a number, "number" tells whether a statement about it carries one.
    With it comes every statement and its label, for checking the labels. The checklist is None when
    there is nothing to label or no statement got a label: a reply that cannot be used must not count as
    a pitch that says nothing. What Gemma replied comes back in its place.
    """
    numbered = {}
    for heading, where, statements in groups:
        for statement in statements:
            numbered[len(numbered) + 1] = (statement, where, heading)

    labels, replies = {}, []
    numbers = list(numbered)
    for start in range(0, len(numbers), STATEMENTS_PER_CALL):
        batch = numbers[start : start + STATEMENTS_PER_CALL]
        lines, heading = [], None
        for n in batch:
            if numbered[n][2] != heading:
                heading = numbered[n][2]
                lines.append(heading)
            lines.append(f"  [{n}] {numbered[n][0]}")
        prompt = LABEL_PROMPT.format(
            statements="\n".join(lines), checklist=CHECKLIST_GUIDE, first=batch[0], last=batch[-1], **wording
        )
        reply, raw = ask([{"type": "text", "text": prompt}])
        replies.append(raw)
        for key, value in (reply or {}).items():
            number = re.search(r"\d+", str(key))
            if number and int(number.group()) in batch and (label := label_of(value)):
                labels[int(number.group())] = label
    if not labels:
        return None, replies

    checklist = []
    for item in CHECKLIST:
        said = [n for n in sorted(labels) if labels[n] == item]
        with_number = [n for n in said if NUMBER.search(numbered[n][0])]
        # Of a topic that needs a number, the statements that carry one are the ones to show
        shown = sorted((with_number if item in NUMBER_TOPICS and with_number else said)[:QUOTED_PER_ITEM])
        entry = {
            "item": item,
            "found": bool(said),
            "quote": " ".join(numbered[n][0] for n in shown),
            **(numbered[said[0]][1] if said else {}),
        }
        if item in NUMBER_TOPICS:
            entry["number"] = bool(with_number)
        checklist.append(entry)
    labelled = [{"statement": numbered[n][0], "label": labels.get(n, "none"), **numbered[n][1]} for n in numbered]
    return checklist, labelled


def rate_topics(checklist: list[dict]) -> dict:
    """The topic coverage criterion, from the expected topics no statement explains; limits as in TOPIC_LEVELS."""
    missing = [c["item"] for c in checklist if c["item"] in PITCH_TOPICS and not c["found"]]
    of = len(PITCH_TOPICS)
    level = 4 if not missing else 3 if 6 * len(missing) <= of else 2 if 3 * len(missing) <= of else 1 if 2 * len(missing) <= of else 0
    reason = f"Not explained: {', '.join(missing)} ({len(missing)} of {of})." if missing else f"All {of} expected topics are explained."
    return {"name": TOPIC_CRITERION, "reason": reason, "level": level}


def rate_numbers(checklist: list[dict]) -> dict | None:
    """The numbers criterion, from the topics that need a number; None when the event's topics have none such."""
    needed = [c for c in checklist if "number" in c]
    if not needed:
        return None
    share = sum(c["number"] for c in needed) / len(needed)
    level = 4 if share == 1 else 3 if share >= 2 / 3 else 2 if share >= 1 / 2 else 1 if share > 0 else 0
    parts = [
        f"{c['item']}: {'stated with a number' if c['number'] else 'no number in what is said about it' if c['found'] else 'not explained'}"
        for c in needed
    ]
    return {"name": NUMBERS_CRITERION, "reason": f"{'; '.join(parts).capitalize()}.", "level": level}


def total(
    rubric: dict[str, Criterion], rated: dict[str, dict], group_weights: dict[str, float]
) -> tuple[list[dict], int | None, dict[str, int]]:
    """The rated criteria in rubric order, the 0-100 score in steps of 5, and the 0-100 score of each group.

    Inside a group a criterion counts by its weight, and the groups count by group_weights. A criterion
    that was not rated drops out of its group instead of counting as 0. A group with nothing rated leaves
    no score: a pitch rated on delivery alone would look better than it is.
    """
    criteria, shares = [], {}
    for group in group_weights:
        names = [name for name, c in rubric.items() if c.group == group and name in rated]
        if names:
            shares[group] = sum(rubric[n].weight * rated[n]["level"] for n in names) / (4 * sum(rubric[n].weight for n in names))
    for name, c in rubric.items():
        if name in rated:
            by, url = SOURCES[c.source]
            criteria.append({
                **rated[name],
                "group": c.group,
                # What level 4 takes, so that a team sees the bar and not only where it stands
                "target": c.levels[0],
                "standard": {"quote": c.quote, "by": by, "url": url},
            })
    subscores = {group: round(share * 20) * 5 for group, share in shares.items()}
    if set(shares) != set(group_weights):
        return criteria, None, subscores
    score = sum(group_weights[group] * share for group, share in shares.items()) / sum(group_weights.values())
    return criteria, round(score * 20) * 5, subscores


def findings(criteria: list[dict]) -> dict[str, str]:
    """The rated criteria as the feedback prompts take them.

    "findings" lists what is below the top level, lowest first, with what the top level takes;
    "strengths" names what is at it. Gemma gave feedback on a criterion at the top level when it was
    shown that criterion's numbers, so those are left out.
    """
    weak = sorted((c for c in criteria if c["level"] < 4), key=lambda c: c["level"])
    return {
        "findings": "\n".join(
            f"- {c['name']}, level {c['level']} of 4: {c['reason']} The top level takes: {c['target']}." for c in weak
        ) or "(nothing: every criterion is at the top level)",
        "strengths": ", ".join(c["name"].lower() for c in criteria if c["level"] == 4) or "nothing",
    }


def share_levels(problem: str) -> list[str]:
    """Level descriptions for a criterion rated by the share of slides that have a problem."""
    return [
        f"none of the slides {problem}",
        f"up to 10% of the slides {problem}",
        f"up to 25% of the slides {problem}",
        f"up to half of the slides {problem}",
        f"more than half of the slides {problem}",
    ]


def time_share_levels(problem: str) -> list[str]:
    """Level descriptions for a criterion rated by the share of the pitch's time that has a problem."""
    return [
        f"no part of the pitch {problem}",
        f"up to 10% of the pitch {problem}",
        f"up to a quarter of the pitch {problem}",
        f"up to half of the pitch {problem}",
        f"more than half of the pitch {problem}",
    ]


def level_for_share(share: float) -> int:
    """The level for a share of slides or of time with a problem; limits as in share_levels() and time_share_levels()."""
    return 4 if share == 0 else 3 if share <= 0.1 else 2 if share <= 0.25 else 1 if share <= 0.5 else 0


def strings(value: object, limit: int) -> list[str]:
    """Gemma's list of strings, without empty or non-string items, at most limit long."""
    if not isinstance(value, list):
        return []
    return [v.strip() for v in value if isinstance(v, str) and v.strip()][:limit]
