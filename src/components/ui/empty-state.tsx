import type { ReactNode } from "react";

interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  children?: ReactNode;
}

export function EmptyState({ icon = "\u{1F50D}", title, description, children }: EmptyStateProps) {
  return (
    <div className="empty-state" role="status">
      <span className="empty-state__emoji" aria-hidden="true">{icon}</span>
      <p className="empty-state__title">{title}</p>
      {description ? <p className="empty-state__description">{description}</p> : null}
      {children ? <div className="empty-state__actions">{children}</div> : null}
    </div>
  );
}