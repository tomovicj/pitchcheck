"""Slide deck analysis: measurements from the PDF file, reading and judgement with Gemma."""

import ctypes
import json
import logging
import os
import re
from collections import Counter
from collections.abc import Callable

import numpy as np
import pypdfium2 as pdfium
import pypdfium2.raw as pdfium_c
from PIL import Image

from app import rubric

logger = logging.getLogger("uvicorn.error")

# Only the first MAX_SLIDES pages are analyzed: each one is a Gemma call
MAX_SLIDES = int(os.getenv("MAX_SLIDES", "20"))
# Visual tokens Gemma spends on one slide: 70, 140, 280, 560 or 1120. More reads small text better and takes longer.
SLIDE_TOKENS = int(os.getenv("SLIDE_TOKENS", "560"))
RENDER_WIDTH = 1600
MAX_SLIDE_TEXT = 1500

# Text sizes are a share of the slide height, so they mean the same on a 540 pt and on a 405 pt page.
# 18 pt on a 540 pt slide is Microsoft's accessibility guidance for slides: a convention, not a study.
SMALL_TEXT_PCT = 100 * 18 / 540
# WCAG 2.2 asks for 4.5:1, or 3:1 for large text: 18 pt, or 14 pt bold. Scaled to the slide the same way.
LARGE_TEXT_PCT = 100 * 18 / 540
LARGE_BOLD_TEXT_PCT = 100 * 14 / 540
# More words than this on a slide reads as paragraphs. A convention: decks sent to be read alone average about 50.
DENSE_WORDS = 60
# A slide counts as having small text when more than this share of its characters is under SMALL_TEXT_PCT,
# so that a source line or a page number does not flag it
SMALL_TEXT_SHARE = 1 / 3
LOW_CONTRAST_SHARE = 0.1

# Gemma rates these two; code rates the rest from what Gemma read on each slide and from the file
GEMMA_CRITERIA = ["Visual consistency", "Structure and flow"]

# Deck rubric: one description per level, from 4 down to 0. Only the contrast limit is a standard
# (WCAG 2.2, written for the web, so a lower bound for a projector). The rest are conventions.
RUBRIC = {
    rubric.TOPIC_CRITERION: rubric.TOPIC_LEVELS,
    "One message per slide": rubric.share_levels("lack a title or make several points"),
    "Text size": rubric.share_levels("have most of their text under 3.3% of the slide height"),
    "Text density": rubric.share_levels(f"have more than {DENSE_WORDS} words"),
    "Contrast": rubric.share_levels("have text under the WCAG contrast of 4.5:1, or 3:1 for large text"),
    "Visual consistency": [
        "the same fonts, title size and colours on every slide",
        "one slide departs from the set",
        "several slides depart from the set",
        "most slides differ from one another",
        "no recognisable system",
    ],
    "Structure and flow": [
        "the first slide says what the team does, the topics follow in an order a viewer can track, "
        "and the last slide sums up and says what comes next",
        "one of the three is weak",
        "one of the three is missing",
        "two of the three are missing",
        "no opening, no order and no closing",
    ],
}

Ask = Callable[..., tuple[dict | None, str]]


class UnreadablePdf(Exception):
    pass


def char_size(textpage: pdfium.PdfTextPage, i: int) -> float:
    """Font size of a character in page points: its size in the text object times the scale of its matrix."""
    size = pdfium_c.FPDFText_GetFontSize(textpage.raw, i)
    matrix = pdfium_c.FS_MATRIX()
    if pdfium_c.FPDFText_GetMatrix(textpage.raw, i, matrix):
        size *= abs(matrix.a * matrix.d - matrix.b * matrix.c) ** 0.5
    return size


def char_font(textpage: pdfium.PdfTextPage, i: int) -> tuple[str, bool]:
    """Font family and whether the face is bold, from names such as ABCDEF+SegoeUI-Bold or Arial-BoldMT."""
    buffer = ctypes.create_string_buffer(256)
    pdfium_c.FPDFText_GetFontInfo(textpage.raw, i, buffer, 256, ctypes.c_int())
    name = buffer.value.decode("utf-8", "replace").split("+", 1)[-1]
    family = re.sub(r"(PS)?MT$", "", re.split(r"[-,]", name)[0])
    bold = "bold" in name.lower() or pdfium_c.FPDFText_GetFontWeight(textpage.raw, i) >= 600
    return family or "unknown", bold


def luminance(rgb) -> float:
    """Relative luminance as WCAG defines it."""
    c = np.asarray(rgb, dtype=float) / 255
    linear = np.where(c <= 0.03928, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    return float(linear @ np.array([0.2126, 0.7152, 0.0722]))


def contrast(a, b) -> float:
    lighter, darker = sorted((luminance(a), luminance(b)), reverse=True)
    return (lighter + 0.05) / (darker + 0.05)


def background(pixels: np.ndarray, box: tuple[float, float, float, float], scale: float, page_height: float):
    """Median colour on the edge of a box a little larger than the character, in the rendered page."""
    left, bottom, right, top = box
    pad = max(2.0, 0.2 * (top - bottom) * scale)
    height, width = pixels.shape[:2]
    x0, x1 = max(int(left * scale - pad), 0), min(int(right * scale + pad), width - 1)
    y0, y1 = max(int((page_height - top) * scale - pad), 0), min(int((page_height - bottom) * scale + pad), height - 1)
    if x1 <= x0 or y1 <= y0:
        return None
    edge = np.concatenate([pixels[y0, x0:x1], pixels[y1, x0:x1], pixels[y0:y1, x0], pixels[y0:y1, x1]])
    return np.median(edge, axis=0)


def measure_page(page: pdfium.PdfPage, image: Image.Image) -> tuple[str, dict | None]:
    """The page's text, and what the file says about it; None for a page without a text layer.

    Text size and font come from the file. Contrast compares the text colour in the file with the
    colour around each character in the rendered page, so over a photo or a gradient it is an estimate.
    """
    width, height = page.get_size()
    pixels, scale = np.asarray(image), image.width / width
    textpage = page.get_textpage()
    try:
        text = textpage.get_text_range().replace("\r", "")
        sizes, families, ratios, low_contrast = Counter(), Counter(), [], 0
        for i in range(textpage.count_chars()):
            code = pdfium_c.FPDFText_GetUnicode(textpage.raw, i)
            size = round(100 * char_size(textpage, i) / height, 1)
            if code <= 32 or chr(code).isspace() or size <= 0:
                continue
            family, bold = char_font(textpage, i)
            sizes[size] += 1
            families[family] += 1

            r, g, b, a = ctypes.c_uint(), ctypes.c_uint(), ctypes.c_uint(), ctypes.c_uint()
            left, right, bottom, top = ctypes.c_double(), ctypes.c_double(), ctypes.c_double(), ctypes.c_double()
            if not pdfium_c.FPDFText_GetFillColor(textpage.raw, i, r, g, b, a):
                continue
            if not pdfium_c.FPDFText_GetCharBox(textpage.raw, i, left, right, bottom, top):
                continue
            around = background(pixels, (left.value, bottom.value, right.value, top.value), scale, height)
            if around is None:
                continue
            ratio = contrast((r.value, g.value, b.value), around)
            large = size >= LARGE_TEXT_PCT or (bold and size >= LARGE_BOLD_TEXT_PCT)
            ratios.append(ratio)
            low_contrast += ratio < (3.0 if large else 4.5)
    finally:
        textpage.close()

    chars = sum(sizes.values())
    if not chars:
        return text, None
    # Sizes carried by a handful of characters are page numbers and bullets, not the text people read
    carried = [size for size, count in sizes.items() if count >= min(20, chars)]
    return text, {
        "words": len(text.split()),
        "characters": chars,
        "smallest_text_pct": min(carried),
        "largest_text_pct": max(size for size, count in sizes.items() if count >= min(3, chars)),
        "small_text_share": round(sum(count for size, count in sizes.items() if size < SMALL_TEXT_PCT) / chars, 2),
        "low_contrast_share": round(low_contrast / len(ratios), 2) if ratios else None,
        "lowest_contrast": round(float(np.percentile(ratios, 5)), 1) if ratios else None,
        "fonts": dict(families),
    }


def read_pdf(data: bytes) -> tuple[int, list[dict]]:
    """Page count, and for each of the first MAX_SLIDES pages its image, text and measurements."""
    try:
        pdf = pdfium.PdfDocument(data)
    except pdfium.PdfiumError as error:
        raise UnreadablePdf("Could not read the PDF. If it is password protected, export it without a password.") from error
    try:
        if len(pdf) == 0:
            raise UnreadablePdf("The PDF has no pages")
        pages = []
        for index in range(min(len(pdf), MAX_SLIDES)):
            page = pdf[index]
            try:
                image = page.render(scale=RENDER_WIDTH / page.get_width()).to_pil().convert("RGB")
                text, measurements = measure_page(page, image)
            finally:
                page.close()
            pages.append({"number": index + 1, "image": image, "text": text, "measurements": measurements})
        return len(pdf), pages
    finally:
        pdf.close()


SLIDE_PROMPT = """You are a presentation coach looking at slide {number} of {count} from a startup pitch deck. Read it as someone in the audience would. Do not judge the business idea.

Text found in the file for this slide (it can be empty or out of order; trust the image for layout):
{text}

Reply with only a JSON object in this shape:
{{"title": "the slide's title, or an empty string if it has none",
 "message": "the main point of the slide in one short sentence",
 "message_count": "one" if everything on the slide supports the same point, "several" if it argues unrelated points,
 "key_points": ["up to 4 short facts or claims from the slide, keeping numbers and names exactly as written"],
 "observations": "one or two sentences on what makes this slide easy or hard to read from the back of a room"}}"""


def observe_slide(ask: Ask, page: dict, count: int) -> dict:
    prompt = SLIDE_PROMPT.format(
        number=page["number"],
        count=count,
        text=page["text"].strip()[:MAX_SLIDE_TEXT] or "(no text in the file)",
    )
    # Image before the text, as recommended for Gemma 4
    observations, raw = ask(
        [{"type": "image", "image": page["image"]}, {"type": "text", "text": prompt}],
        images_kwargs={"max_soft_tokens": SLIDE_TOKENS},
    )
    return {"observations": observations, **({} if observations else {"raw": raw})}


def name_slides(numbers: list[int]) -> str:
    if len(numbers) == 1:
        return f"slide {numbers[0]}"
    return "slides " + ", ".join(map(str, numbers[:-1])) + f" and {numbers[-1]}"


def rate_share(name: str, flagged: list[int], of: int, finding: str) -> dict:
    """A criterion rated by the share of slides that have a problem."""
    level = rubric.level_for_share(len(flagged) / of)
    reason = f"{name_slides(flagged).capitalize()}: {finding}." if flagged else f"No slide: {finding}."
    return {"name": name, "reason": reason, "level": level}


def rate_measured(slides: list[dict]) -> dict[str, dict]:
    """The criteria that follow from counts: what Gemma read on each slide, and what the file says."""
    rated = {}
    read = [s for s in slides if s["observations"]]
    if read:
        unfocused = [
            s["number"] for s in read
            if not str(s["observations"].get("title") or "").strip() or s["observations"].get("message_count") == "several"
        ]
        rated["One message per slide"] = rate_share(
            "One message per slide", unfocused, len(read), "no title, or several points on one slide"
        )

    measured = [s for s in slides if s["measurements"]]
    if measured:
        small = [s["number"] for s in measured if s["measurements"]["small_text_share"] > SMALL_TEXT_SHARE]
        rated["Text size"] = rate_share(
            "Text size", small, len(measured), "most of the text is under 3.3% of the slide height (18 pt on a standard slide)"
        )
        dense = [s["number"] for s in measured if s["measurements"]["words"] > DENSE_WORDS]
        rated["Text density"] = rate_share("Text density", dense, len(measured), f"more than {DENSE_WORDS} words")
        compared = [s for s in measured if s["measurements"]["low_contrast_share"] is not None]
        if compared:
            faint = [s["number"] for s in compared if s["measurements"]["low_contrast_share"] > LOW_CONTRAST_SHARE]
            rated["Contrast"] = rate_share(
                "Contrast", faint, len(compared), "text under the WCAG contrast of 4.5:1, or 3:1 for large text"
            )
    return rated


def measured_problems(slides: list[dict]) -> list[str]:
    """What the file measurements flag, slide by slide, with the numbers: the raw material for feedback."""
    problems = []
    for s in slides:
        m = s["measurements"]
        if not m:
            continue
        if m["words"] > DENSE_WORDS:
            problems.append(f"- Slide {s['number']} has {m['words']} words; more than {DENSE_WORDS} reads as paragraphs.")
        if m["small_text_share"] > SMALL_TEXT_SHARE:
            problems.append(
                f"- Slide {s['number']}: {m['small_text_share']:.0%} of the text is under 3.3% of the slide height "
                f"(18 pt on a standard slide); the smallest is {m['smallest_text_pct']}%."
            )
        if m["low_contrast_share"] is not None and m["low_contrast_share"] > LOW_CONTRAST_SHARE:
            problems.append(
                f"- Slide {s['number']}: {m['low_contrast_share']:.0%} of the text has a contrast of about "
                f"{m['lowest_contrast']}:1 against its background; WCAG asks for 4.5:1."
            )
    return problems


def measure_deck(slides: list[dict]) -> dict | None:
    """Deck-level numbers from the file; None when no page has a text layer."""
    measured = [s["measurements"] for s in slides if s["measurements"]]
    if not measured:
        return None
    fonts = Counter()
    for m in measured:
        # A bullet glyph in a fallback font is not a font choice; a title in another font is
        fonts.update({f: count for f, count in m["fonts"].items() if count >= max(3, 0.03 * m["characters"])})
    words = sorted(m["words"] for m in measured)
    return {
        "words_median": words[len(words) // 2],
        "words_max": words[-1],
        "smallest_text_pct": min(m["smallest_text_pct"] for m in measured),
        "fonts": [f for f, _ in fonts.most_common()],
    }


def describe_slide(slide: dict) -> str:
    o, m = slide["observations"], slide["measurements"]
    parts = [f"- Slide {slide['number']}:"]
    if o:
        parts.append(json.dumps({k: o.get(k) for k in ("title", "message", "message_count", "key_points", "observations")}))
    else:
        parts.append("(not read)")
    if m:
        parts.append(
            f"[file: {m['words']} words, largest text {m['largest_text_pct']}% of slide height, smallest {m['smallest_text_pct']}%, "
            f"fonts {', '.join(m['fonts'])}]"
        )
    return " ".join(parts)


DECK_PROMPT = """You are a presentation coach reviewing a startup pitch deck against a fixed rubric. Review how the deck presents the idea, never the business idea or its market potential.

The deck has {count} slides. What each slide shows, as you read it earlier, with numbers from the file where it has a text layer:
{slides}

Already rated from counts and measurements:
{findings}

Problems measured in the file:
{problems}

A pitch deck is expected to explain these topics: {topics}.
First decide, for each topic, which slides explain it. A slide that describes what goes wrong today explains the problem, even when the product is named on it.

Then give each of these criteria the level, from 4 down to 0, whose description fits best:
{rubric}

Reply with only a JSON object in this shape:
{{"topic_slides": {{"problem": [2], ...one entry per expected topic, with the numbers of the slides that explain it, or an empty list when no slide does}},
 "criteria": [{{"name": "Visual consistency", "reason": "one sentence naming the slides it rests on", "level": 0}}, ...one entry per criterion above, in the same order],
 "insights": ["what the review found, 3 to 5 short statements"],
 "feedback": [{{"slide": 1, "text": "one concrete thing to change"}}]}}
Give 3 to 6 feedback items. Start with one item for each measured problem above, naming the slide and the number that was measured; then add what you found yourself. Set slide to the number of the slide the feedback refers to, or null if it applies to the whole deck."""


def topic_slides(reply: dict, numbers: set[int]) -> dict[str, list[int]] | None:
    """Gemma's map from each expected topic to the slides that explain it; None when the reply has no such map."""
    mapping = reply.get("topic_slides")
    if not isinstance(mapping, dict):
        return None
    found = {}
    for topic in rubric.PITCH_TOPICS:
        value = mapping.get(topic)
        found[topic] = sorted({n for n in value if type(n) is int and n in numbers}) if isinstance(value, list) else []
    return found


def review_deck(ask: Ask, slides: list[dict], page_count: int) -> tuple[dict | None, dict[str, list[int]] | None]:
    """Rate the deck: counts in code, judgement by Gemma, and one 0-100 score over both.

    Returns the summary and which slides explain each expected topic.
    """
    rated = rate_measured(slides)
    if not any(s["observations"] for s in slides):
        # Nothing was read, so there is nothing for Gemma to review; the file measurements still stand
        criteria, score = rubric.total(RUBRIC, rated)
        return ({"slide_score": score, "criteria": criteria, "insights": [], "feedback": []} if criteria else None), None

    findings = [f"- {c['name']}: level {c['level']}. {c['reason']}" for c in rated.values()]
    if not any(s["measurements"] for s in slides):
        findings.append("- The PDF has no text layer, so text size, density and contrast were not measured.")
    prompt = DECK_PROMPT.format(
        count=page_count,
        slides="\n".join(describe_slide(s) for s in slides),
        findings="\n".join(findings),
        problems="\n".join(measured_problems(slides)) or "(none)",
        topics=rubric.TOPIC_GUIDE,
        rubric=rubric.describe(RUBRIC, GEMMA_CRITERIA),
    )
    reply, _ = ask([{"type": "text", "text": prompt}])
    reply = reply or {}
    topics = topic_slides(reply, {s["number"] for s in slides})
    if topics is not None:
        rated[rubric.TOPIC_CRITERION] = rubric.rate_topics([topic for topic, numbers in topics.items() if not numbers])
    rated.update(rubric.gemma_levels(reply.get("criteria"), GEMMA_CRITERIA))
    criteria, score = rubric.total(RUBRIC, rated)
    feedback = [
        {"slide": f.get("slide") if isinstance(f.get("slide"), int) else None, "text": f["text"].strip()}
        for f in (reply.get("feedback") if isinstance(reply.get("feedback"), list) else [])
        if isinstance(f, dict) and isinstance(f.get("text"), str) and f["text"].strip()
    ]
    summary = {
        "slide_score": score,
        "criteria": criteria,
        "insights": rubric.strings(reply.get("insights"), 5),
        "feedback": feedback[:6],
    }
    return summary, topics


def run_analysis(page_count: int, pages: list[dict], ask: Ask, report: Callable[[str, float], None]) -> dict:
    """Read and review the pages from read_pdf(), reporting (stage, overall 0-1 progress) along the way."""
    slides = []
    for n, page in enumerate(pages, start=1):
        report("reading", 0.85 * (n - 1) / len(pages))
        logger.info("Reading slide %s/%s", n, len(pages))
        slides.append({
            "number": page["number"],
            "measurements": page["measurements"],
            **observe_slide(ask, page, page_count),
        })

    report("reviewing", 0.85)
    summary, topics = review_deck(ask, slides, page_count)
    return {
        "page_count": page_count,
        "pages_analyzed": len(pages),
        "text_layer": any(s["measurements"] for s in slides),
        "measurements": measure_deck(slides),
        # Which slides explain each expected topic, as Gemma mapped them; null when it gave no map
        "topic_slides": topics,
        "slides": slides,
        "summary": summary,
    }
