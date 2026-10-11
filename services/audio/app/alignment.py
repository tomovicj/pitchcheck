"""Does the spoken pitch follow the deck: deck points the speech never explains, and statements that disagree.

Works on the key points Gemma took from each slide and on the statements it heard in each segment of
the recording. The result is a report next to the two scores, not part of either: a misheard number
should not move a score.
"""

import re
from collections.abc import Callable

from app import rubric

Ask = Callable[..., tuple[dict | None, str]]

# Key points kept per slide, and statements kept per segment of speech
SLIDE_POINTS = 4
SPEECH_POINTS = 12

ALIGN_PROMPT = """You are checking whether a spoken startup pitch follows its slide deck. You have the key points of each slide and what the speaker said, in order.

The speaker does not have to read the slides. Summarising a slide, rephrasing it or adding explanation that is not on it is fine and is not a finding. Do not judge the business idea.

Key points of the slides:
{slides}

What the speaker said:
{speech}

Find only these two things:
1. Key points of the slides that the speaker never explains, in any wording. Most key points are usually explained; list only the ones that are not.
2. Contradictions: a key point of a slide and a statement of the speaker that disagree on a number, a name or a claim. The same fact in other words is not a contradiction.

Reply with only a JSON object in this shape:
{{"unexplained": [{{"slide": 2, "point": "one key point, copied from the list above"}}],
 "contradictions": [{{"slide": 5, "at_s": 62, "slide_says": "the few words on the slide that disagree", "speaker_says": "the few words of the speaker that disagree"}}],
 "summary": "two sentences on what the team builds and for whom, as the deck and the speech present it",
 "recommendations": ["2 to 4 concrete changes that would bring the talk and the deck in line"]}}
Use empty lists when there is nothing to report. Set at_s to the start second of the part of the speech in which the speaker says it."""


def format_time(seconds: float) -> str:
    return f"{int(seconds // 60)}:{int(seconds % 60):02d}"


def text(value: object) -> str:
    return value.strip() if isinstance(value, str) else ""


def plain(value: str) -> str:
    """Lower case without punctuation, for telling whether two wordings are the same text."""
    return " ".join(re.sub(r"[^\w\s]", " ", value.lower()).split())


def narrow(slide_says: str, speaker_says: str) -> tuple[str, str]:
    """Cut a contradiction down to the two fragments that disagree on a number, when there are such.

    Gemma often returns every key point of the slide and the whole statement. Of the fragments whose
    numbers have nothing in common, the pair that shares the largest part of its words is about the
    same thing and disagrees on it.
    """
    best, closest = None, 0.0
    for a in re.split(r";\s+|(?<=[.!?])\s+", slide_says):
        for b in re.split(r";\s+|(?<=[.!?])\s+", speaker_says):
            numbers_a, numbers_b = set(re.findall(r"\d+(?:[.,]\d+)?", a)), set(re.findall(r"\d+(?:[.,]\d+)?", b))
            words_a, words_b = set(plain(a).split()) - numbers_a, set(plain(b).split()) - numbers_b
            if not numbers_a or not numbers_b or numbers_a & numbers_b or not words_a or not words_b:
                continue
            overlap = len(words_a & words_b) / min(len(words_a), len(words_b))
            if overlap > closest:
                best, closest = (a.strip(), b.strip()), overlap
    return best or (slide_says, speaker_says)


def run(ask: Ask, slides: list[dict], segments: list[dict]) -> dict | None:
    """Compare the deck with the speech; None when either side has nothing to compare or Gemma's reply does not parse."""
    points = {}
    for s in slides:
        kept = rubric.strings((s["observations"] or {}).get("key_points"), SLIDE_POINTS)
        if kept:
            points[s["number"]] = kept
    spoken = []
    for s in segments:
        said = rubric.strings((s["observations"] or {}).get("key_points"), SPEECH_POINTS)
        if said:
            spoken.append(f"- {format_time(s['start_s'])}-{format_time(s['end_s'])} (starts at {round(s['start_s'])}s): {' '.join(said)}")
    if not points or not spoken:
        return None

    prompt = ALIGN_PROMPT.format(
        slides="\n".join(f"- Slide {n}: {'; '.join(kept)}" for n, kept in points.items()),
        speech="\n".join(spoken),
    )
    reply, _ = ask([{"type": "text", "text": prompt}])
    if reply is None:
        return None

    # Gemma tends to return several points of a slide in one entry: match each entry against the
    # slide's own points, so that the count is in key points and not in entries
    unexplained = []
    for u in reply.get("unexplained") if isinstance(reply.get("unexplained"), list) else []:
        if not isinstance(u, dict) or u.get("slide") not in points or not text(u.get("point")):
            continue
        named = [p for p in points[u["slide"]] if plain(p) and plain(p) in plain(u["point"])]
        for point in named or [text(u["point"])]:
            entry = {"slide": u["slide"], "point": point}
            if entry not in unexplained:
                unexplained.append(entry)

    contradictions = []
    for c in reply.get("contradictions") if isinstance(reply.get("contradictions"), list) else []:
        if not isinstance(c, dict):
            continue
        slide_says, speaker_says = text(c.get("slide_says")), text(c.get("speaker_says"))
        # The same words on both sides are an agreement that Gemma filed under contradictions
        if not plain(slide_says) or not plain(speaker_says) or plain(slide_says) in plain(speaker_says) or plain(speaker_says) in plain(slide_says):
            continue
        at_s = c.get("at_s")
        slide_says, speaker_says = narrow(slide_says, speaker_says)
        contradictions.append({
            "slide": c.get("slide") if c.get("slide") in points else None,
            "at_s": at_s if type(at_s) in (int, float) and at_s >= 0 else None,
            "slide_says": slide_says,
            "speaker_says": speaker_says,
        })

    total = sum(len(kept) for kept in points.values())
    unexplained = unexplained[:total]
    return {
        "deck_points": total,
        "unexplained": unexplained,
        # Share of the deck's key points the speech never explains, on the same levels as the deck rubric
        "coverage_level": rubric.level_for_share(len(unexplained) / total),
        "contradictions": contradictions,
        "summary": text(reply.get("summary")),
        "recommendations": rubric.strings(reply.get("recommendations"), 4),
    }
