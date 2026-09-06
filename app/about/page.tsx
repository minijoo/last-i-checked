import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About · Last I Checked",
};

export default function AboutPage() {
  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-xl font-semibold tracking-tight">About</h1>

      <div className="flex flex-col gap-6">
        <p className="text-lg leading-relaxed text-muted">
          Have you ever checked a number on the public internet — like a betting
          line, a team&apos;s win percentage, or a weather forecast — and found
          yourself going back to that page over and over to see if it changed? But
          you don&apos;t remember exactly what the number was the last time.
        </p>

        <p className="text-2xl font-semibold tracking-tight text-foreground">
          Introducing Last I Checked.
        </p>

        <p className="text-sm leading-relaxed text-muted">
          It remembers the last value you saw — for stocks, forecasts, sportsbook
          lines, and any other page you point it at — so every visit shows you
          what moved, and by how much, since you last looked.
        </p>
      </div>

      <p className="text-sm text-muted">
        Built by{" "}
        <a
          href="https://x.com/justaswe"
          target="_blank"
          rel="noreferrer"
          className="text-foreground underline hover:opacity-80"
        >
          Jordy
        </a>
        .
      </p>
    </div>
  );
}
