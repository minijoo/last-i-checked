// Shared low-level UI atoms.
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";

export function Button({
  variant = "solid",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "solid" | "outline" | "ghost";
}) {
  const base =
    "inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none";
  const styles = {
    solid: "bg-foreground text-background hover:opacity-90",
    outline: "border border-border hover:bg-surface",
    ghost: "text-muted hover:text-foreground hover:bg-surface",
  }[variant];
  return <button className={`${base} ${styles} ${className}`} {...props} />;
}

/**
 * Text input. When it has a `placeholder`, that text becomes a floating label:
 * it rests inside the box and, on focus or once there's a value, shrinks and
 * slides to the top-left (Instagram-style). Pass `floatingLabel={false}` for a
 * plain placeholder. `className` lands on the wrapper (width, font) so callers
 * size it the same way either mode.
 */
export function Input({
  className = "",
  placeholder,
  floatingLabel = true,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { floatingLabel?: boolean }) {
  const field =
    "rounded-md border border-border bg-surface px-3 text-sm outline-none focus:border-foreground";

  if (!floatingLabel || !placeholder) {
    return (
      <input
        className={`${field} py-1.5 placeholder:text-muted ${className}`}
        placeholder={placeholder}
        {...props}
      />
    );
  }

  // The native placeholder is a single space so `:placeholder-shown` tells the
  // label whether the field is empty; the real text lives in the label.
  return (
    <div className={`relative ${className}`}>
      <input
        aria-label={props["aria-label"] ?? placeholder}
        {...props}
        placeholder=" "
        className={`peer w-full ${field} pb-1 pt-[15px]`}
      />
      <span
        aria-hidden
        className="float-label pointer-events-none absolute left-[13px] top-1/2 max-w-[calc(100%-1.5rem)] origin-left -translate-y-1/2 truncate text-sm text-muted peer-focus:max-w-[calc((100%-1.5rem)/0.72)] peer-focus:-translate-y-[calc(50%+9px)] peer-focus:scale-[0.72] peer-not-placeholder-shown:max-w-[calc((100%-1.5rem)/0.72)] peer-not-placeholder-shown:-translate-y-[calc(50%+9px)] peer-not-placeholder-shown:scale-[0.72]"
      >
        {placeholder}
      </span>
    </div>
  );
}

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl border border-border bg-surface p-4 ${className}`}
    >
      {children}
    </div>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">
      {children}
    </h2>
  );
}
