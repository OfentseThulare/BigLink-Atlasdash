"use client";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="state-page">
      <p className="eyebrow">Portal error</p>
      <h1>We could not load this view</h1>
      <p>The financial record was not changed. Try loading the view again.</p>
      <button className="primary-button" type="button" onClick={reset}>Try again</button>
    </main>
  );
}
