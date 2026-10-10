import { AudioAnalyzer } from "@/components/audio-analyzer";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-4 py-12">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">pitchcheck</h1>
        <p className="text-muted-foreground">
          Upload a recording of your pitch to get feedback on cadence, tonality and emotion.
        </p>
      </div>
      <AudioAnalyzer />
    </main>
  );
}
