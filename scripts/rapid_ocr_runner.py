import json
import sys
from pathlib import Path

from rapidocr_onnxruntime import RapidOCR


def _top_left(row):
    box = row[0] if row else []
    xs = [point[0] for point in box if len(point) >= 2]
    ys = [point[1] for point in box if len(point) >= 2]
    return (min(ys) if ys else 0, min(xs) if xs else 0)


def main():
    if len(sys.argv) < 2:
        raise SystemExit("Uso: rapid_ocr_runner.py <image_path>")

    image_path = Path(sys.argv[1]).resolve()
    if not image_path.exists():
        raise SystemExit(f"No existe imagen: {image_path}")

    ocr = RapidOCR()
    result, _ = ocr(str(image_path))
    rows = sorted(result or [], key=_top_left)
    items = [
        {
            "text": str(row[1]).strip(),
            "score": float(row[2]) if len(row) > 2 else None,
            "box": row[0],
        }
        for row in rows
        if len(row) > 1 and str(row[1]).strip()
    ]
    print(json.dumps({
        "text": "\n".join(item["text"] for item in items),
        "items": items,
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()
