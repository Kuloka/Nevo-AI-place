import argparse
import json
import os
import shutil
import sys


MODEL_ID = "stabilityai/sd-turbo"


def emit(payload):
    print(json.dumps(payload, ensure_ascii=False), flush=True)


def fail(message, code=1):
    emit({"ok": False, "error": message})
    sys.exit(code)


def status(stage, message):
    emit({"ok": None, "stage": stage, "message": message})


def main():
    parser = argparse.ArgumentParser(description="Generate an image with Stable Diffusion Turbo.")
    parser.add_argument("--model", required=True)  # Installation marker managed by the desktop app.
    parser.add_argument("--cache-dir", default=None)
    parser.add_argument("--prompt", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--variant", default="sd-turbo")
    parser.add_argument("--compute", default="auto", choices=["auto", "gpu", "cpu"])
    args = parser.parse_args()

    try:
        import torch
        from diffusers import AutoPipelineForText2Image
    except Exception as exc:
        fail("Python packages are missing. Install torch, diffusers, transformers, accelerate and safetensors. " + str(exc))

    device = "cuda" if torch.cuda.is_available() and args.compute != "cpu" else "cpu"
    dtype = torch.float16 if device == "cuda" else torch.float32
    try:
        status("loading", "Loading SD Turbo model")
        try:
            pipe = AutoPipelineForText2Image.from_pretrained(
                MODEL_ID,
                torch_dtype=dtype,
                cache_dir=args.cache_dir,
            )
        except Exception as exc:
            # A cancelled first download can leave an incomplete snapshot (for example vae/config.json missing).
            is_incomplete_snapshot = (
                exc.__class__.__name__ == "IncompleteSnapshotError"
                or "no file named config.json" in str(exc).lower()
                or "incomplete snapshot" in str(exc).lower()
            )
            if not is_incomplete_snapshot:
                raise
            status("downloading", "Repairing incomplete SD Turbo model files")
            if args.cache_dir:
                broken_snapshot = os.path.join(args.cache_dir, "models--stabilityai--sd-turbo")
                shutil.rmtree(broken_snapshot, ignore_errors=True)
            pipe = AutoPipelineForText2Image.from_pretrained(
                MODEL_ID,
                torch_dtype=dtype,
                cache_dir=args.cache_dir,
                force_download=True,
            )
        if device == "cuda":
            pipe = pipe.to("cuda")
        else:
            pipe = pipe.to("cpu")
            pipe.enable_attention_slicing()

        status("generating", "Generating image")
        generator = torch.Generator(device=device).manual_seed(abs(hash(args.prompt)) % (2 ** 32))
        image = pipe(
            prompt=args.prompt,
            num_inference_steps=2,
            guidance_scale=0.0,
            generator=generator,
        ).images[0]
        os.makedirs(os.path.dirname(args.output), exist_ok=True)
        image.save(args.output)
        status("done", "Image ready")
        emit({"ok": True, "path": args.output})
    except Exception as exc:
        fail(str(exc))


if __name__ == "__main__":
    main()
