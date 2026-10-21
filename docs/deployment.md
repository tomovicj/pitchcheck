# Running PitchCheck

PitchCheck has two parts:

- **web** (`apps/web`): the Next.js app with the landing page, the upload cards, the results and `/verify`.
- **analysis** (`services/analysis`): a FastAPI service that runs Gemma 4 locally through Hugging Face Transformers and does all of the analysis.

The web app sends uploads to the service named in `ANALYSIS_SERVICE_URL` (default `http://localhost:8000`). All settings are listed in [`.env.example`](../.env.example).

## With Docker Compose

```bash
cp .env.example .env   # optional; set HF_TOKEN if Hugging Face asks for the Gemma license
docker compose up --build
```

The web app runs on http://localhost:3000 and the analysis service on http://localhost:8000. The first start downloads the Gemma weights, which are several GB, into the `models` volume, so it can take a while. The web container waits until the analysis service reports healthy.

### From prebuilt images

Every push to `main` publishes both images to GitHub Container Registry (`.github/workflows/images.yml`) for `linux/amd64` and `linux/arm64`. That covers x86 machines and Apple Silicon natively. The images are public, so no login is needed. Copy `docker-compose.yml` to the machine and run:

```bash
docker compose pull
docker compose up -d
```

Images are tagged `latest` and `sha-<short commit>`. Set `TAG=sha-abc1234` to run a specific build. The images are `ghcr.io/tomovicj/pitchcheck-web` and `ghcr.io/tomovicj/pitchcheck-analysis`. Images built before the rename to `analysis` were published as `pitchcheck-audio`.

## Without Docker

You need Node 24 with pnpm 10, and Python 3.12 with `ffmpeg` on the PATH. Use two terminals:

```bash
pnpm install
pnpm dev            # http://localhost:3000
```

```bash
cd services/analysis
pip install -r requirements.txt
uvicorn app.main:app --port 8000
```

Other workspace scripts, run from the repository root: `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm build`.

Sometimes `pnpm dev` keeps serving old styles or old code after a `git pull`. That means the dev server missed a file change, which happened with the repository inside a OneDrive folder on Windows. Put `NEXT_WATCH_POLL_MS=1000` in `apps/web/.env.local` to make the dev server poll for changes.

## On a Kaggle GPU

This is for a laptop that cannot run Gemma:

1. Import `notebooks/kaggle.ipynb` into Kaggle.
2. Follow its first cell: turn on the GPU and Internet, and add an `HF_TOKEN` secret.
3. Run all cells. The notebook clones the branch in `BRANCH` (default `main`), starts the analysis service and prints a Cloudflare tunnel URL.
4. Run the web app locally against that URL:

```bash
ANALYSIS_SERVICE_URL=https://<printed-url> pnpm dev
```

The last cell keeps following the branch. About every 30 seconds it fetches. When a push changed something under `services/analysis`, it installs a changed `requirements.txt` and restarts the service on the new code. It does not fetch while an analysis is running. The tunnel URL stays the same until the Kaggle session ends. `setup.code_sha256` in `GET <url>/health` tells you which code is answering.

A long request through the quick tunnel does not always survive. On 11 October 2026, three of five combined checks lost their connection two to three minutes in, while the service went on and finished. The result of such a check is lost, because the service keeps nothing.

The page and the service have to be the same version. The page shows an error instead of results when the service behind it is older.

With Kaggle, the recording and the deck leave the laptop. Use it for development and demos only (see [Privacy](../README.md#privacy)).

## Configuration

| Variable | Default | Meaning |
| --- | --- | --- |
| `ANALYSIS_SERVICE_URL` | `http://localhost:8000` | Where the web app sends uploads |
| `HF_TOKEN` | – | Hugging Face token, if the Gemma license has to be accepted |
| `GEMMA_MODEL` | `google/gemma-4-E2B-it` | Must take audio: E2B, E4B or 12B Unified (`gemma-4-12B-it`) |
| `GEMMA_DEVICE_MAP` | `auto` on GPU, `cpu` otherwise | `cpu` keeps the whole model in RAM instead of offloading layers to disk |
| `GEMMA_DTYPE` | `auto` (bf16) | Use `float16` on GPUs without bf16, such as the T4 |
| `SLIDE_TOKENS` | `560` | Visual tokens per slide: 70, 140, 280, 560 or 1120. More reads small text better and is slower |
| `MAX_SLIDES` | `20` | Pages of a deck that are analyzed |
| `SEGMENT_SECONDS` | `20` | Longest audio segment sent to Gemma, at most 30 |
| `PITCH_TOPICS` | Y Combinator's eight | An event's own expected topics as JSON, name to meaning, e.g. `{"problem": "what hurts, and for whom", "go-to-market": "how it reaches buyers"}`. Both rubrics use it. The numbers criterion looks at topics named `market` and `traction` |
| `NEXT_WATCH_POLL_MS` | – | Makes `next dev` poll for file changes |

## Troubleshooting

- **The app does not start.** Check `docker compose ps -a` and `docker compose logs --tail=100 analysis`. Older images can fail with `AnyToAnyPipeline requires the librosa library`. To rebuild the image from this checkout and keep the downloaded weights, run `docker compose build analysis && docker compose up -d --no-build --pull never`.
- **Analysis stays at 5% ("Gemma is listening").** The percentage does not move until the first audio segment finishes. `docker compose logs -f analysis` logs each Gemma call: the time to the first output token, progress every 32 tokens, and the final token count. It logs counts and timings only, never the recording or the model's text. A long wait for the first token points to input processing. Slow progress after that points to text generation. `/health` also reports `analysis_running` and `model_devices`.
- **HTTP 429.** Only one analysis runs at a time. A second request is refused instead of competing for model memory.
- **Slow on a laptop.** If the machine has enough free RAM, set `GEMMA_DEVICE_MAP=cpu` and recreate the container. E2B has about 10.2 GB of weights, plus more memory for inference. In a short diagnostic on an Apple M5 with 16 GB (one second of silence, eight output tokens), automatic CPU/disk placement took 22.4 s and full CPU placement took 7.5 s.

## Performance

These are single runs, not benchmarks.

| Machine | Input | Time |
| --- | --- | --- |
| Laptop CPU, 16 threads, 12 GB Docker VM, bf16 | 31 s recording | about 4 min |
| Laptop CPU, same | 8-slide deck | about 13 min (50–80 s per slide) |
| Laptop CPU, same | 1 min recording + 8-slide deck, combined | 16–19 min over five runs |
| Kaggle T4, float16 | 31 s recording | 64 s |
| Kaggle T4, float16 | 1 min recording + 8-slide deck, combined, YC rubric | 5 min 11 s – 5 min 18 s |

For a real event, the organizer's server needs a GPU to keep the wait short.

On one machine the first rubric repeated exactly: the test recording gave the same levels, score and feedback in two runs, and the test deck gave the same levels and score in four. Repeatability has not been measured again since the rubric changed, and it has not been measured across machines at all.
