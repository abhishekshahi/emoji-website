export default function SearchLoading() {
  return (
    <div
      className="card-surface px-6 py-12 text-center text-muted"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      Loading search results...
    </div>
  );
}
