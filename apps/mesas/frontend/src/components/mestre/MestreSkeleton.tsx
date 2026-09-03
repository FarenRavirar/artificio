import { TableCardSkeleton } from '../TableCard';

export function MestreSkeleton() {
  return (
    <main className="min-h-screen bg-[var(--color-artificio-blue)] text-[var(--fg)]">
      {/* Hero skeleton */}
      <section className="hero-section">
        <div className="hero-banner-gradient" />
        <div className="hero-overlay" />
        <div className="hero-content">
          <div className="mx-auto mb-6 w-36 h-36 rounded-[var(--radius-pill)] bg-[var(--fill-10)] animate-pulse" />
          <div className="mx-auto mb-4 h-10 w-72 bg-[var(--fill-10)] rounded-[var(--radius-md)] animate-pulse" />
          <div className="mx-auto mb-2 h-4 w-96 max-w-full bg-[var(--fill-5)] rounded-[var(--radius-md)] animate-pulse" />
          <div className="mx-auto mb-6 h-4 w-80 max-w-full bg-[var(--fill-5)] rounded-[var(--radius-md)] animate-pulse" />
          <div className="flex justify-center gap-3">
            <div className="h-12 w-40 bg-[var(--fill-10)] rounded-[var(--radius-lg)] animate-pulse" />
            <div className="h-12 w-44 bg-[var(--fill-10)] rounded-[var(--radius-lg)] animate-pulse" />
          </div>
        </div>
      </section>

      {/* Grid skeleton */}
      <div className="container mx-auto px-6 py-16 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {Array.from({ length: 6 }).map((_, idx) => (
          <TableCardSkeleton key={idx} />
        ))}
      </div>
    </main>
  );
}
