# Extracts the anatomical lexicon that ships inside the Z-Anatomy Blender file.
#
# The .blend carries two things the atlas needs and that would otherwise have to
# be written by hand: a Translations table (English, Latin and three romance
# languages) and one text block per structure holding its definition, taken
# from Wikipedia.
#
# Run headless:
#   blender --background assets-src/Z-Anatomy/Startup.blend \
#           --python tools/export-lexicon.py
#
# Writes public/data/lexicon.json and public/data/definitions.json.
import bpy
import json
import os
import re
import sys

PROJECT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(PROJECT, "public", "data")

# Enough for the two or three sentences an info panel shows; the rest of the
# article is a click away on Wikipedia.
MAX_DEFINITION_CHARS = 600


def base_of(name):
    return name[:-2] if name.endswith((".l", ".r")) else name


def normalise(name):
    name = name.strip()
    # Z-Anatomy wraps names outside the official terminology in parentheses.
    name = re.sub(r"^\((.*)\)$", r"\1", name).strip()
    return name.lower()


def clean_definition(raw, title):
    text = raw.replace("\r", "")

    # Each block opens with a heading in capitals, which is not always spelled
    # the same as the structure ("ATRIUM (HEART)" for "Left atrium").
    lines = [line.strip() for line in text.split("\n")]
    lines = [line for line in lines if line]
    while lines and len(lines[0]) < 70 and lines[0] == lines[0].upper() and any(c.isalpha() for c in lines[0]):
        lines = lines[1:]

    text = " ".join(lines)

    # Artefacts of the wiki-to-text conversion.
    text = text.replace("(, ", "(").replace(" )", ")")
    text = re.sub(r"\(\s*\)", "", text)
    text = re.sub(r"\s+", " ", text).strip()

    if len(text) <= MAX_DEFINITION_CHARS:
        return text

    # Cut on a sentence boundary rather than mid-word.
    cut = text[:MAX_DEFINITION_CHARS]
    stop = max(cut.rfind(". "), cut.rfind("; "))
    return (cut[:stop + 1] if stop > 200 else cut.rstrip() + "...").strip()


def main():
    with open(os.path.join(DATA, "systems.json"), encoding="utf-8") as handle:
        systems = json.load(handle)

    # Structures are indexed by base name: left and right share everything.
    names = {}
    for members in systems.values():
        for member in members:
            names.setdefault(base_of(member), member)

    translations = {}
    table = bpy.data.texts.get("Translations")
    if table:
        rows = table.as_string().splitlines()
        columns = [column.strip() for column in rows[0].split(";")]
        for row in rows[1:]:
            cells = row.split(";")
            if len(cells) < 2 or not cells[0].strip():
                continue
            translations.setdefault(normalise(cells[0]), dict(zip(columns, [c.strip() for c in cells])))

    definitions_source = {}
    for text in bpy.data.texts:
        if text.name == "Translations":
            continue
        definitions_source.setdefault(normalise(text.name), (text.name, text.as_string()))

    lexicon = {}
    definitions = {}

    for base in sorted(names):
        key = normalise(base)
        entry = {}

        row = translations.get(key)
        if row:
            # The table repeats Z-Anatomy's parentheses; the flag below already
            # says the term is unofficial, so they are noise here.
            latin = re.sub(r"^\((.*)\)$", r"\1", row.get("Latin", "").strip()).strip()
            if latin and latin.lower() != key:
                entry["la"] = latin

        # A parenthesised name is Z-Anatomy's marker for a term outside
        # Terminologia Anatomica; keep the flag, not the parentheses.
        if base.startswith("(") and base.endswith(")"):
            entry["official"] = False

        if entry:
            lexicon[base] = entry

        source = definitions_source.get(key)
        if source:
            cleaned = clean_definition(source[1], base)
            if len(cleaned) > 40:
                definitions[base] = cleaned

    os.makedirs(DATA, exist_ok=True)
    with open(os.path.join(DATA, "lexicon.json"), "w", encoding="utf-8") as handle:
        json.dump(lexicon, handle, ensure_ascii=False, separators=(",", ":"), sort_keys=True)
    with open(os.path.join(DATA, "definitions.json"), "w", encoding="utf-8") as handle:
        json.dump(definitions, handle, ensure_ascii=False, separators=(",", ":"), sort_keys=True)

    report = {
        "structures": len(names),
        "with_latin": sum(1 for v in lexicon.values() if "la" in v),
        "non_official": sum(1 for v in lexicon.values() if v.get("official") is False),
        "with_definition": len(definitions),
        "lexicon_kb": round(os.path.getsize(os.path.join(DATA, "lexicon.json")) / 1024),
        "definitions_kb": round(os.path.getsize(os.path.join(DATA, "definitions.json")) / 1024)
    }
    print("lexicon export:", json.dumps(report))
    return report


if __name__ == "__main__":
    main()
    # Blender's --background exits on its own; this keeps a non-zero status from
    # a failed import going unnoticed.
    sys.stdout.flush()
