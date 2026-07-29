import json
import sys
from pathlib import Path

from paddleocr import PaddleOCR


def _box_top_left(item):
    box = item.get("dt_polys") or item.get("box") or item.get("bbox") or []
    if hasattr(box, "tolist"):
        box = box.tolist()
    if not box:
        return (0, 0)
    xs = [point[0] for point in box if len(point) >= 2]
    ys = [point[1] for point in box if len(point) >= 2]
    return (min(ys) if ys else 0, min(xs) if xs else 0)


def _extract_text_items(result):
    items = []
    for page_result in result:
        if isinstance(page_result, dict):
            texts = page_result.get("rec_texts") or []
            scores = page_result.get("rec_scores") or []
            boxes = page_result.get("rec_polys") or page_result.get("dt_polys") or []
            for index, text in enumerate(texts):
                box = boxes[index] if index < len(boxes) else []
                if hasattr(box, "tolist"):
                    box = box.tolist()
                items.append({
                    "text": str(text).strip(),
                    "score": float(scores[index]) if index < len(scores) else None,
                    "box": box,
                })
        elif isinstance(page_result, list):
            for line in page_result:
                if not line or len(line) < 2:
                    continue
                text_info = line[1]
                text = text_info[0] if isinstance(text_info, (list, tuple)) and text_info else ""
                score = text_info[1] if isinstance(text_info, (list, tuple)) and len(text_info) > 1 else None
                items.append({"text": str(text).strip(), "score": score, "box": line[0]})
    return [item for item in items if item["text"]]


def main():
    if len(sys.argv) < 2:
        raise SystemExit("Uso: paddle_ocr_runner.py <image_path>")

    image_path = Path(sys.argv[1]).resolve()
    if not image_path.exists():
        raise SystemExit(f"No existe imagen: {image_path}")

    ocr = PaddleOCR(
        lang="es",
        ocr_version="PP-OCRv5",
        use_doc_orientation_classify=False,
        use_doc_unwarping=False,
        use_textline_orientation=False,
    )
    result = ocr.predict(str(image_path))
    items = _extract_text_items(result)
    items.sort(key=_box_top_left)

    print(json.dumps({
        "text": "\n".join(item["text"] for item in items),
        "items": items,
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()


