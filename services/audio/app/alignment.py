"""Does the spoken pitch follow the deck: deck points the speech never explains, and statements that disagree.

Works on the key points Gemma took from each slide and from each segment of the recording. The result
is a report next to the two scores, not part of either: a misheard number should not move a score.
"""

from collections.abc import Callable

from app import rubric

Ask = Callable[..., tuple[dict | None, str]]

ALIGN_PROMPT = """You are checking whether a spoken startup pitch follows its slide deck. You have the key points of each slide and the key points of what the speaker said, in order.

The speaker does not have to read the slides. Summarising a slide, rephrasing it or adding explanation that is not on it is fine and is not a finding. Do not judge the business idea.

Slides:
{slides}

Speech:
{speech}

Find only these two things:
1. Key points of the deck that the speech never explains, in any wording.
2. Contradictions: places where the speech and a slide disagree on a number, a name or a claim.

Reply with only a JSON object in this shape:
{{"unexplained": [{{"slide": 2, "point": "the key point, as on the slide"}}],
 "contradictions": [{{"slide": 5, "at_s": 62, "slide_says": "what the slide says", "speaker_says": "what the speaker says"}}],
 "summary": "two sentences on what the team builds and for whom, as the deck and the speech present it",
 "recommendations": ["2 to 4 concrete changes that would bring the talk and the deck in line"]}}
Use empty lists when there is nothing to report. Set at_s to the start second of the segment in which the speaker says it."""


def format_time(seconds: float) -> str:
    return f"{int(seconds // 60)}:{int(seconds % 60):02d}"


def text(value: object) -> str:
    return value.strip() if isinstance(value, str) else ""


def run(ask: Ask, slides: list[dict], segments: list[dict]) -> dict | None:
    """Compare the deck with the speech; None when either side has no key points or Gemma's reply does not parse."""
    deck_points, spoken = {}, []
    for s in slides:
        points = rubric.strings((s["observations"] or {}).get("key_points"), 4)
        if points:
            deck_points[s["number"]] = (text((s["observations"] or {}).get("title")), points)
    for s in segments:
        points = rubric.strings((s["observations"] or {}).get("key_points"), 4)
        if points:
            spoken.append(f"- {format_time(s['start_s'])}-{format_time(s['end_s'])} (starts at {round(s['start_s'])}s): {'; '.join(points)}")
    if not deck_points or not spoken:
        return None

    prompt = ALIGN_PROMPT.format(
        slides="\n".join(f'- Slide {n} "{title}": {"; ".join(points)}' for n, (title, points) in deck_points.items()),
        speech="\n".join(spoken),
    )
    reply, _ = ask([{"type": "text", "text": prompt}])
    if reply is None:
        return None

    total = sum(len(points) for _, points in deck_points.values())
    unexplained = [
        {"slide": u["slide"], "point": text(u.get("point"))}
        for u in (reply.get("unexplained") if isinstance(reply.get("unexplained"), list) else [])
        if isinstance(u, dict) and u.get("slide") in deck_points and text(u.get("point"))
    ][:total]
    contradictions = [
        {
            "slide": c.get("slide") if c.get("slide") in deck_points else None,
            "at_s": c.get("at_s") if isinstance(c.get("at_s"), (int, float)) and not isinstance(c.get("at_s"), bool) else None,
            "slide_says": text(c.get("slide_says")),
            "speaker_says": text(c.get("speaker_says")),
        }
        for c in (reply.get("contradictions") if isinstance(reply.get("contradictions"), list) else [])
        if isinstance(c, dict) and text(c.get("slide_says")) and text(c.get("speaker_says"))
    ]
    return {
        "deck_points": total,
        "unexplained": unexplained,
        # Share of the deck's key points the speech never explains, on the same levels as the deck rubric
        "coverage_level": rubric.level_for_share(len(unexplained) / total),
        "contradictions": contradictions,
        "summary": text(reply.get("summary")),
        "recommendations": rubric.strings(reply.get("recommendations"), 4),
    }
