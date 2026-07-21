import Link from "next/link";

export default function NotFound() {
  return (
    <main className="state-page">
      <p className="eyebrow">404</p>
      <h1>Record not found</h1>
      <p>The requested page or financial record is unavailable.</p>
      <Link className="primary-button" href="/">Return to overview</Link>
    </main>
  );
}
