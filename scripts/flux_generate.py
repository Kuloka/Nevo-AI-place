import argparse
import json
import os
import sys


BFL_FLUX_SCHNELL_REPO = "black-forest-labs/FLUX.1-schnell"


def fail(message, code=1):
    print(json.dumps({"ok": False, "error": message}, ensure_ascii=False))
    sys.exit(code)


def status(stage, message):
    print(json.dumps({"ok": None, "stage": stage, "message": message}, ensure_ascii=False), flush=True)


def main():
    parser = argparse.ArgumentParser(description="Generate an image with a local Flux Schnell checkpoint.")
    parser.add_argument("--model", required=True)
    parser.add_argument("--cache-dir", default=None)
    parser.add_argument("--prompt", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--variant", default="fp8")
    parser.add_argument("--compute", default="auto", choices=["auto", "gpu", "cpu"])
    args = parser.parse_args()

    if not os.path.exists(args.model):
        fail("Model file was not found.")

    try:
        import torch
        from diffusers import FluxPipeline, FluxTransformer2DModel
    except Exception as exc:
        fail(
            "Python packages are missing. Install torch, diffusers, transformers, accelerate, sentencepiece and safetensors. "
            + str(exc)
        )

    device = "cuda" if torch.cuda.is_available() and args.compute != "cpu" else "cpu"
    dtype = torch.float16 if device == "cuda" and args.variant != "fp8" else torch.bfloat16 if device == "cuda" else torch.float32
    status("loading", "Loading Flux model")

    def load_official_pipeline():
        return FluxPipeline.from_pretrained(
            BFL_FLUX_SCHNELL_REPO,
            torch_dtype=dtype,
            cache_dir=args.cache_dir,
        )

    try:
        try:
            transformer = FluxTransformer2DModel.from_single_file(args.model, torch_dtype=dtype)
            pipe = FluxPipeline.from_pretrained(
                BFL_FLUX_SCHNELL_REPO,
                transformer=transformer,
                torch_dtype=dtype,
                cache_dir=args.cache_dir,
            )
        except Exception as exc:
            status("downloading", f"Loading official Flux components after local checkpoint failed: {exc}")
            pipe = load_official_pipeline()

        status("preparing", f"Preparing {device.upper()} pipeline")
        if device == "cuda":
            pipe.enable_model_cpu_offload()
        else:
            pipe = pipe.to("cpu")

        status("generating", "Generating image")
        image = pipe(
            args.prompt,
            guidance_scale=0.0,
            num_inference_steps=4,
            max_sequence_length=256,
            generator=torch.Generator(device=device).manual_seed(abs(hash(args.prompt)) % (2**32)),
        ).images[0]

        os.makedirs(os.path.dirname(args.output), exist_ok=True)
        image.save(args.output)
        status("done", "Image ready")
        print(json.dumps({"ok": True, "path": args.output}, ensure_ascii=False))
    except Exception as exc:
        fail(str(exc))


if __name__ == "__main__":
    main()
