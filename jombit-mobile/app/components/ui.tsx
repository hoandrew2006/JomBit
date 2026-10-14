"use client";
/* eslint-disable jsx-a11y/no-noninteractive-element-interactions */

import { X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { LOGO_LARGE, LOGO_ON_DARK, LOGO_ON_LIGHT } from "@/lib/brand";

// Logo mark + "JomBit" wordmark. The image carries the accessible name, so the wordmark is hidden
// from screen readers. Use onLight only on light backgrounds.
export function Brand({ compact = false, onLight = false }: { compact?: boolean; onLight?: boolean }) {
  const logo = onLight ? LOGO_ON_LIGHT : LOGO_ON_DARK;
  return (
    <div className={`brand ${compact ? "brand-compact" : ""}`}>
      <img className="brand-logo" src={logo.src} width={logo.width} height={logo.height} alt="JomBit" decoding="async" />
      <span className="brand-wordmark" aria-hidden="true">JomBit</span>
    </div>
  );
}

// Large centred logo for the sign-up and loading screens (dark backgrounds only).
export function BrandLogo({ className = "" }: { className?: string }) {
  return <img className={`brand-logo-large ${className}`} src={LOGO_LARGE.src} width={LOGO_LARGE.width} height={LOGO_LARGE.height} alt="JomBit" decoding="async" />;
}

export function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" | "lg" }) {
  const initials = name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return <span className={`avatar avatar-${size}`}>{initials}</span>;
}

export function PageHeader({
  eyebrow,
  title,
  action,
}: {
  eyebrow?: string;
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-header">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
      </div>
      {action}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  copy,
  action,
}: {
  icon: ReactNode;
  title: string;
  copy: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">{icon}</span>
      <h3>{title}</h3>
      <p>{copy}</p>
      {action}
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  eyebrow,
  children,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  eyebrow?: string;
  children: ReactNode;
  wide?: boolean;
}) {
  const dialog = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement;
    dialog.current?.focus();
    return () => { if (previous instanceof HTMLElement && previous.isConnected) previous.focus(); };
  }, [open]);
  if (!open) return null;
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        ref={dialog}
        tabIndex={-1}
        className={`modal-sheet ${wide ? "modal-wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); onClose(); }
          if (event.key !== "Tab") return;
          const targets = Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]') ?? []).filter((element) => element.getClientRects().length > 0);
          const first = targets[0];
          const last = targets[targets.length - 1];
          if (!first) { event.preventDefault(); dialog.current?.focus(); }
          else if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { event.preventDefault(); last.focus(); }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
        }}
      >
        <div className="modal-handle" />
        <div className="modal-head">
          <div>
            {eyebrow && <p className="eyebrow">{eyebrow}</p>}
            <h2>{title}</h2>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}

export function Toast({ message }: { message?: string }) {
  if (!message) return null;
  return <div className="toast" role="status">{message}</div>;
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="segmented">
      {options.map((option) => (
        <button
          key={option.value}
          className={option.value === value ? "active" : ""}
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
          type="button"
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

