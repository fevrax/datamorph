import type { ReactNode } from "react";

interface ToolPanelProps {
  title: ReactNode;
  actions?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
}

export default function ToolPanel({
  title,
  actions,
  footer,
  children,
  className = "",
}: ToolPanelProps) {
  return (
    <section className={`tool-panel ${className}`}>
      <div className="tool-panel-header">
        <h2>{title}</h2>
        {actions && <div className="tool-panel-actions">{actions}</div>}
      </div>
      <div className="tool-panel-body">{children}</div>
      {footer && <div className="tool-panel-footer">{footer}</div>}
    </section>
  );
}
