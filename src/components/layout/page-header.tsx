interface PageHeaderProps {
  title: string;
  description?: string;
  eyebrow?: string;
}

export function PageHeader({ title, description, eyebrow }: PageHeaderProps) {
  return (
    <header className="space-y-3">
      {eyebrow ? (
        <p className="section-header__eyebrow">{eyebrow}</p>
      ) : null}
      <h1 className="text-display">{title}</h1>
      {description ? (
        <p className="text-lead max-w-2xl">{description}</p>
      ) : null}
    </header>
  );
}
