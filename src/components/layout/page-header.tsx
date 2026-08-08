interface PageHeaderProps {
  title: string;
  description?: string;
  eyebrow?: string;
}

export function PageHeader({ title, description, eyebrow }: PageHeaderProps) {
  return (
    <header className="space-y-3">
      {eyebrow ? (
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-accent-strong">
          {eyebrow}
        </p>
      ) : null}
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
      {description ? <p className="max-w-2xl text-muted">{description}</p> : null}
    </header>
  );
}
