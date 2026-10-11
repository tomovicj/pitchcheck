"""Slide deck analysis: measurements from the PDF file, reading and judgement with Gemma."""

import base64
import ctypes
import io
import json
import logging
import os
import re
import statistics
from collections import Counter, defaultdict
from collections.abc import Callable

import numpy as np
import pypdfium2 as pdfium
import pypdfium2.raw as pdfium_c
from PIL import Image

from app import alignment, rubric

logger = logging.getLogger("uvicorn.error")

# Only the first MAX_SLIDES pages are analyzed: each one is a Gemma call
MAX_SLIDES = int(os.getenv("MAX_SLIDES", "20"))
# Visual tokens Gemma spends on one slide: 70, 140, 280, 560 or 1120. More reads small text better and takes longer.
SLIDE_TOKENS = int(os.getenv("SLIDE_TOKENS", "560"))
RENDER_WIDTH = 1600
THUMBNAIL_WIDTH = 320
MAX_SLIDE_TEXT = 1500

# Text sizes are a share of the slide height, so they mean the same on a 540 pt and on a 405 pt page.
# 24 pt on a 540 pt slide is the minimum Penn State's accessibility guidance gives for slides projected
# before a live audience (accessibility.psu.edu/legibility/fontsize). Y Combinator says "use large type"
# and gives no number. It was 18 pt, Microsoft's figure for a document read on a screen.
# Rounded like the measured sizes, so that text of exactly 24 pt is not counted as smaller than 24 pt.
SMALL_TEXT_PCT = round(100 * 24 / 540, 1)
# WCAG 2.2 asks for 4.5:1, or 3:1 for large text: 18 pt, or 14 pt bold. Scaled to the slide the same way.
LARGE_TEXT_PCT = round(100 * 18 / 540, 1)
LARGE_BOLD_TEXT_PCT = round(100 * 14 / 540, 1)
# More words than this on a slide is too many to take in while someone is talking. Y Combinator's limit
# for a slide shown on stage is 7 words (Ralston); a deck that is also sent to be read needs more, and
# 40 is a title with six lines of six words. A convention; it was 60.
DENSE_WORDS = 40
# A slide counts as having small text when more than this share of its characters is under SMALL_TEXT_PCT,
# so that a source line or a page number does not flag it
SMALL_TEXT_SHARE = 1 / 3
LOW_CONTRAST_SHARE = 0.1
# Where the title is looked for, and where the largest text must not sit: shares of the slide height
# from the top. "Put important text at the top of the slide" (Ralston); the two limits are conventions.
TITLE_ZONE_PCT = 30
LOW_TEXT_PCT = 60
# A title whose size is this far from the deck's usual title size, as a share of it, departs from the set
TITLE_SIZE_TOLERANCE = 0.15

OPENING_CRITERION = "Title slide"
FOCUS_CRITERION = "One message per slide"
WORDS_CRITERION = "Words per slide"
SIZE_CRITERION = "Text size"
CONTRAST_CRITERION = "Contrast"
TOP_CRITERION = "Key text at the top"
CONSISTENCY_CRITERION = "Visual consistency"
LENGTH_CRITERION = "Deck length"

# Deck rubric: what the deck says, and how it is designed. One description per level, from 4 down to 0;
# every level is a count, a share or a measurement and is given in code. The two groups count the same,
# and inside the content group the topics count three times and their numbers twice, so that a deck
# cannot score well on a clear first slide and plain words alone. Those weights are this team's.
GROUP_WEIGHTS = {"content": 0.5, "design": 0.5}
RUBRIC = {
    OPENING_CRITERION: rubric.Criterion(
        "content",
        [
            "the first slide says what the company does",
            "the second slide is the first to say it",
            "the third slide is the first to say it",
            "a later slide is the first to say it",
            "no slide says what the company does",
        ],
        "This is the title page. It has the name of your company, and a one line description of what you do.",
        "harris",
    ),
    rubric.TOPIC_CRITERION: rubric.Criterion(
        "content",
        rubric.TOPIC_LEVELS,
        "The deck below is a template for how I think companies should build seed decks.",
        "harris",
        weight=3,
    ),
    rubric.NUMBERS_CRITERION: rubric.Criterion(
        "content", rubric.NUMBER_LEVELS, "Make the numbers clear and meaningful.", "harris", weight=2
    ),
    rubric.PLAIN_CRITERION: rubric.Criterion(
        "content",
        rubric.share_levels("use a marketing or jargon word from the list"),
        "eliminate jargon, acronyms, marketing speak, and any ambiguous terms such as \"platform\"",
        "seibel",
    ),
    FOCUS_CRITERION: rubric.Criterion(
        "design",
        rubric.share_levels("lack a title or make several points"),
        "A slide should have one main point, never more.",
        "ralston",
    ),
    WORDS_CRITERION: rubric.Criterion(
        "design",
        rubric.share_levels(f"have more than {DENSE_WORDS} words"),
        "Minimize the number of words on a slide.",
        "ralston",
    ),
    SIZE_CRITERION: rubric.Criterion(
        "design",
        rubric.share_levels(f"have most of their text under {SMALL_TEXT_PCT:.1f}% of the slide height"),
        "Legible slides are ones that even old people sitting in the back row with bad eyesight can read.",
        "hale",
    ),
    CONTRAST_CRITERION: rubric.Criterion(
        "design",
        rubric.share_levels("have text under the WCAG contrast of 4.5:1, or 3:1 for large text"),
        "The visual presentation of text and images of text has a contrast ratio of at least 4.5:1",
        "wcag",
    ),
    TOP_CRITERION: rubric.Criterion(
        "design",
        rubric.share_levels(f"have their largest text in the lower {100 - LOW_TEXT_PCT}% of the slide"),
        "Put important text at the top of the slide.",
        "ralston",
    ),
    CONSISTENCY_CRITERION: rubric.Criterion(
        "design",
        rubric.share_levels("use a font or a title size the rest of the deck does not"),
        "",
        "convention",
    ),
    # Harris's template has ten slides, and Hale gives 5 to 7 for a deck shown on stage; the steps are this team's
    LENGTH_CRITERION: rubric.Criterion(
        "design",
        ["12 slides or fewer", "13 to 15 slides", "16 to 20 slides", "21 to 30 slides", "more than 30 slides"],
        "The key point to remember here is that founders should strive for clarity and concision.",
        "harris",
    ),
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
        # For each text size, how far down the slide each of its characters sits, as a share of the height
        depths = defaultdict(list)
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
            if not pdfium_c.FPDFText_GetCharBox(textpage.raw, i, left, right, bottom, top):
                continue
            depths[size].append(100 * (1 - (bottom.value + top.value) / 2 / height))
            if not pdfium_c.FPDFText_GetFillColor(textpage.raw, i, r, g, b, a):
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
    largest = max(size for size, count in sizes.items() if count >= min(3, chars))
    # The title is taken to be the largest text in the top of the slide; a slide can have none there
    titles = [size for size, places in depths.items() if sum(depth <= TITLE_ZONE_PCT for depth in places) >= 3]
    return text, {
        "words": len(text.split()),
        "characters": chars,
        "smallest_text_pct": min(carried),
        "largest_text_pct": largest,
        # How far down the slide the largest text sits: 0 is the top edge, 100 the bottom
        "largest_text_depth_pct": round(float(np.mean(depths[largest]))) if depths[largest] else None,
        "title_text_pct": max(titles) if titles else None,
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
    reason = f"{name_slides(flagged).capitalize()}: {finding}." if flagged else f"No slide is marked for this ({finding})."
    return {"name": name, "reason": reason, "level": level}


def slide_fonts(m: dict) -> set[str]:
    """The font families a slide is set in. A bullet glyph in a fallback font is not a font choice; a title in another font is."""
    return {font for font, count in m["fonts"].items() if count >= max(3, 0.03 * m["characters"])}


def rate_consistency(measured: list[dict]) -> dict | None:
    """The visual consistency criterion, from the file; None for a deck too short to have a set.

    A slide departs when it is set in a font that most slides do not use, or when its title is of
    another size than the deck's usual one. Colours and layout are not measured.
    """
    if len(measured) < 3:
        return None
    used = Counter(font for s in measured for font in slide_fonts(s["measurements"]))
    common = {font for font, count in used.items() if 2 * count >= len(measured)}
    # A title slide is set larger on purpose: it does not define the usual title size and is not held to it
    title_sizes = {s["number"]: s["measurements"]["title_text_pct"] for s in measured if s["number"] != 1}
    title_sizes = {number: size for number, size in title_sizes.items() if size}
    usual = statistics.median(title_sizes.values()) if title_sizes else None
    departs = [
        s["number"] for s in measured
        if slide_fonts(s["measurements"]) - common
        or (s["number"] in title_sizes and abs(title_sizes[s["number"]] - usual) > TITLE_SIZE_TOLERANCE * usual)
    ]
    return rate_share(
        CONSISTENCY_CRITERION, departs, len(measured), "a font or a title size the rest of the deck does not use"
    )


def rate_design(slides: list[dict], page_count: int) -> dict[str, dict]:
    """The design criteria: what Gemma read on each slide, and what the file says."""
    rated = {}
    read = [s for s in slides if s["observations"]]
    if read:
        unfocused = [
            s["number"] for s in read
            if not str(s["observations"].get("title") or "").strip() or s["observations"].get("message_count") == "several"
        ]
        rated[FOCUS_CRITERION] = rate_share(FOCUS_CRITERION, unfocused, len(read), "no title, or several points on one slide")

    measured = [s for s in slides if s["measurements"]]
    if measured:
        small = [s["number"] for s in measured if s["measurements"]["small_text_share"] > SMALL_TEXT_SHARE]
        rated[SIZE_CRITERION] = rate_share(
            SIZE_CRITERION, small, len(measured),
            f"most of the text is under {SMALL_TEXT_PCT:.1f}% of the slide height (24 pt on a standard slide)",
        )
        dense = [s["number"] for s in measured if s["measurements"]["words"] > DENSE_WORDS]
        rated[WORDS_CRITERION] = rate_share(WORDS_CRITERION, dense, len(measured), f"more than {DENSE_WORDS} words")
        compared = [s for s in measured if s["measurements"]["low_contrast_share"] is not None]
        if compared:
            faint = [s["number"] for s in compared if s["measurements"]["low_contrast_share"] > LOW_CONTRAST_SHARE]
            rated[CONTRAST_CRITERION] = rate_share(
                CONTRAST_CRITERION, faint, len(compared), "text under the WCAG contrast of 4.5:1, or 3:1 for large text"
            )
        # The first slide is left out: a title slide puts the name of the company in the middle
        placed = [s for s in measured if s["number"] != 1 and s["measurements"]["largest_text_depth_pct"] is not None]
        if placed:
            low = [s["number"] for s in placed if s["measurements"]["largest_text_depth_pct"] > LOW_TEXT_PCT]
            rated[TOP_CRITERION] = rate_share(
                TOP_CRITERION, low, len(placed), f"the largest text sits in the lower {100 - LOW_TEXT_PCT}% of the slide"
            )
        if consistency := rate_consistency(measured):
            rated[CONSISTENCY_CRITERION] = consistency

    level = 4 if page_count <= 12 else 3 if page_count <= 15 else 2 if page_count <= 20 else 1 if page_count <= 30 else 0
    rated[LENGTH_CRITERION] = {"name": LENGTH_CRITERION, "reason": f"The deck has {page_count} slides.", "level": level}
    return rated


def slide_statements(slide: dict) -> list[str]:
    """What a slide says, as Gemma read it: the title, then the key points that do not repeat it."""
    observations = slide["observations"] or {}
    said = []
    for statement in [observations.get("title"), *rubric.strings(observations.get("key_points"), alignment.SLIDE_POINTS)]:
        if isinstance(statement, str) and statement.strip() and statement.strip().lower() not in [s.lower() for s in said]:
            said.append(statement.strip())
    return said


def rate_opening(checklist: list[dict]) -> dict:
    """The title slide criterion, from the first slide that says what the company does; limits as in RUBRIC."""
    said = next(c for c in checklist if c["item"] == rubric.OPENING)
    if not said["found"]:
        return {"name": OPENING_CRITERION, "reason": "No slide says what the company does.", "level": 0}
    reason = f"Slide {said['slide']} says it: \"{said['quote']}\""
    return {"name": OPENING_CRITERION, "reason": reason, "level": max(1, 5 - said["slide"])}


def rate_plain(slides: list[dict], texts: dict[int, str]) -> dict | None:
    """The plain language criterion, from the listed marketing and jargon words on each slide.

    The words come from the slide's text in the file, or from what Gemma read where the file has none.
    None when no slide has any text to look at.
    """
    worded = {s["number"]: texts.get(s["number"], "").strip() or " ".join(slide_statements(s)) for s in slides}
    worded = {number: words for number, words in worded.items() if words}
    if not worded:
        return None
    found = {number: rubric.buzzwords(words) for number, words in worded.items()}
    flagged = [number for number, words in found.items() if words]
    criterion = rate_share(rubric.PLAIN_CRITERION, flagged, len(worded), "a marketing or jargon word from the list")
    if flagged:
        listed = sorted({word for words in found.values() for word in words})
        criterion["reason"] = f"{name_slides(flagged).capitalize()}: {', '.join(listed)}."
    return criterion


def measured_problems(slides: list[dict]) -> list[str]:
    """What the file measurements flag, slide by slide, with the numbers: the raw material for feedback."""
    problems = []
    for s in slides:
        m = s["measurements"]
        if not m:
            continue
        if m["words"] > DENSE_WORDS:
            problems.append(
                f"- Slide {s['number']} has {m['words']} words; more than {DENSE_WORDS} is too many to read while someone is talking."
            )
        if m["small_text_share"] > SMALL_TEXT_SHARE:
            problems.append(
                f"- Slide {s['number']}: {m['small_text_share']:.0%} of the text is under {SMALL_TEXT_PCT:.1f}% of the slide height "
                f"(24 pt on a standard slide); the smallest is {m['smallest_text_pct']}%."
            )
        if m["low_contrast_share"] is not None and m["low_contrast_share"] > LOW_CONTRAST_SHARE:
            problems.append(
                f"- Slide {s['number']}: {m['low_contrast_share']:.0%} of the text has a contrast of about "
                f"{m['lowest_contrast']}:1 against its background; WCAG asks for 4.5:1."
            )
        if s["number"] != 1 and m["largest_text_depth_pct"] is not None and m["largest_text_depth_pct"] > LOW_TEXT_PCT:
            problems.append(
                f"- Slide {s['number']}: the largest text sits {m['largest_text_depth_pct']}% of the way down the slide; "
                "people at the back of a room see the top best."
            )
    return problems


def measure_deck(slides: list[dict]) -> dict | None:
    """Deck-level numbers from the file; None when no page has a text layer."""
    measured = [s["measurements"] for s in slides if s["measurements"]]
    if not measured:
        return None
    fonts = Counter()
    for m in measured:
        fonts.update({font: m["fonts"][font] for font in slide_fonts(m)})
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


# How the checklist prompt names a deck; see rubric.CHECK_PROMPT
SLIDES = {
    "kind": "startup pitch deck",
    "heard": "What each slide says, in order, as you read it",
    "plural": "decks",
}

FEEDBACK_PROMPT = """You are a presentation coach giving feedback on a startup pitch deck. It was rated against a fixed rubric, each criterion on a level from 0 (worst) to 4 (best). Comment on what the deck says and on how it is designed, never on the business idea or its market potential.

The deck has {count} slides. What each slide shows, as you read it earlier, with numbers from the file where it has a text layer:
{slides}

How the deck was rated:
{findings}

Problems measured in the file:
{problems}

Reply with only a JSON object in this shape:
{{"insights": ["what the review found, 3 to 5 short statements"],
 "feedback": [{{"slide": 1, "text": "one concrete thing to change"}}]}}
Give 3 to 6 feedback items. Take the criteria with the lowest levels first: name the slide and the number that was measured, or the topic that is missing, and say what to do about it. Give no feedback on a criterion at level 4. Set slide to the number of the slide the feedback refers to, or null if it applies to the whole deck."""


def review_deck(ask: Ask, slides: list[dict], page_count: int, texts: dict[int, str]) -> dict:
    """Rate the deck and collect the feedback on it.

    Gemma says which of the lines it read say each expected thing, code gives every level from that
    and from the file, and Gemma writes the insights and the feedback from the rated findings.
    texts holds the text of each page in the file, by slide number.
    """
    rated = rate_design(slides, page_count)
    checklist = rubric.run_checklist(
        ask, [(f"Slide {s['number']}:", {"slide": s["number"]}, slide_statements(s)) for s in slides], **SLIDES
    )
    # Content is rated as a whole or not at all: plain language alone would pass for a deck that says nothing
    if checklist:
        rated[OPENING_CRITERION] = rate_opening(checklist)
        rated[rubric.TOPIC_CRITERION] = rubric.rate_topics(checklist)
        if numbers := rubric.rate_numbers(checklist):
            rated[rubric.NUMBERS_CRITERION] = numbers
        if plain := rate_plain(slides, texts):
            rated[rubric.PLAIN_CRITERION] = plain
    criteria, score, subscores = rubric.total(RUBRIC, rated, GROUP_WEIGHTS)
    summary = {
        "slide_score": score,
        # The 0-100 score of each group of criteria: what the deck says, and how it is designed
        "subscores": subscores,
        "criteria": criteria,
        # Where the deck says each expected thing; empty when Gemma's reply could not be used
        "checklist": checklist or [],
        "insights": [],
        "feedback": [],
    }
    if not any(s["observations"] for s in slides):
        # Nothing was read, so there is nothing for Gemma to comment on; the file measurements still stand
        return summary

    findings = [f"- {c['name']}: level {c['level']} of 4. {c['reason']} Level 4 takes: {c['target']}." for c in criteria]
    if not any(s["measurements"] for s in slides):
        findings.append("- The PDF has no text layer, so text size, word count, contrast and consistency were not measured.")
    prompt = FEEDBACK_PROMPT.format(
        count=page_count,
        slides="\n".join(describe_slide(s) for s in slides),
        findings="\n".join(findings),
        problems="\n".join(measured_problems(slides)) or "(none)",
    )
    reply, _ = ask([{"type": "text", "text": prompt}])
    reply = reply or {}
    feedback = [
        {"slide": f.get("slide") if isinstance(f.get("slide"), int) else None, "text": f["text"].strip()}
        for f in (reply.get("feedback") if isinstance(reply.get("feedback"), list) else [])
        if isinstance(f, dict) and isinstance(f.get("text"), str) and f["text"].strip()
    ]
    return {**summary, "insights": rubric.strings(reply.get("insights"), 5), "feedback": feedback[:6]}


def thumbnail(image: Image.Image) -> str:
    """A small JPEG of the page as a data URL, so the results can show which slide a note is about."""
    small = image.copy()
    small.thumbnail((THUMBNAIL_WIDTH, THUMBNAIL_WIDTH))
    buffer = io.BytesIO()
    small.save(buffer, "JPEG", quality=70)
    return "data:image/jpeg;base64," + base64.b64encode(buffer.getvalue()).decode()


def run_analysis(page_count: int, pages: list[dict], ask: Ask, report: Callable[[str, float], None]) -> dict:
    """Read and review the pages from read_pdf(), reporting (stage, overall 0-1 progress) along the way."""
    slides = []
    for n, page in enumerate(pages, start=1):
        report("reading", 0.85 * (n - 1) / len(pages))
        logger.info("Reading slide %s/%s", n, len(pages))
        slides.append({
            "number": page["number"],
            "thumbnail": thumbnail(page["image"]),
            "measurements": page["measurements"],
            **observe_slide(ask, page, page_count),
        })

    report("reviewing", 0.85)
    return {
        "page_count": page_count,
        "pages_analyzed": len(pages),
        "text_layer": any(s["measurements"] for s in slides),
        "measurements": measure_deck(slides),
        "slides": slides,
        "summary": review_deck(ask, slides, page_count, {page["number"]: page["text"] for page in pages}),
    }
