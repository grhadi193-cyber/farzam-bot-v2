#!/usr/bin/env python3
"""Transcribe one voice file in Persian with faster-whisper.

Usage: transcribe.py <audio-path> [model]
Prints one JSON object: {"text": "..."}.
The model downloads on first use if it is not cached.
"""
import json
import sys

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"text": ""}))
        return 0
    audio = sys.argv[1]
    model_name = sys.argv[2] if len(sys.argv) > 2 else "small"
    from faster_whisper import WhisperModel
    model = WhisperModel(model_name, device="cpu", compute_type="int8")
    segments, _info = model.transcribe(audio, language="fa")
    text = " ".join(s.text.strip() for s in segments).strip()
    print(json.dumps({"text": text}, ensure_ascii=False))
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
