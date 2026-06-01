#!/usr/bin/env python3
"""
Convert MiniFASNet (Silent-Face-Anti-Spoofing, minivision-ai, Apache-2.0) from
the upstream PyTorch .pth into a TFLite model for on-device passive anti-spoof.

Output:  models/minifasnet.tflite   (face crop 80x80, float32, 3-class output)

This is a build-time/offline step (no Python is needed on the phone). Run it on
any machine with Python 3.9+:

    pip install torch onnx numpy ai-edge-torch
    python scripts/convert_minifasnet.py

Notes / verify-on-device:
  * Upstream model is NCHW [1,3,80,80]; the app feeds NHWC [1,80,80,3] from the
    resize plugin. ai-edge-torch handles the layout; if your converter does not,
    transpose the input or add a leading transpose op.
  * Input normalization here is [0,1] (resize dataType:'float32'); confirm the
    threshold/realClassIndex in DEFAULT_LIVENESS_CONFIG against real captures.
"""
import pathlib
import subprocess
import sys
import tempfile
import urllib.request

REPO = "https://github.com/minivision-ai/Silent-Face-Anti-Spoofing"
PTH_URL = (
    REPO + "/raw/master/resources/anti_spoof_models/2.7_80x80_MiniFASNetV2.pth"
)
OUT = pathlib.Path(__file__).resolve().parent.parent / "models" / "minifasnet.tflite"


def main() -> None:
    import torch  # noqa: WPS433 (lazy import so the help text works without torch)

    work = pathlib.Path(tempfile.mkdtemp())
    # 1. Pull the MiniFASNet architecture definition from the upstream repo.
    subprocess.check_call(
        ["git", "clone", "--depth", "1", REPO, str(work / "sf")]
    )
    sys.path.insert(0, str(work / "sf"))
    from src.model_lib.MiniFASNet import MiniFASNetV2  # type: ignore

    # 2. Build and load the Apache-2.0 weights (checkpoints use a "module." prefix).
    model = MiniFASNetV2(conv6_kernel=(5, 5)).eval()
    pth = work / "model.pth"
    urllib.request.urlretrieve(PTH_URL, pth)
    state = torch.load(pth, map_location="cpu")
    state = {k.replace("module.", ""): v for k, v in state.items()}
    model.load_state_dict(state)

    # 3. Convert torch -> tflite.
    import ai_edge_torch  # type: ignore

    sample = torch.rand(1, 3, 80, 80)
    edge_model = ai_edge_torch.convert(model, (sample,))
    edge_model.export(str(OUT))
    print(f"Wrote {OUT}")


if __name__ == "__main__":
    main()
