import {
  forwardRef,
  useEffect,
  type AnchorHTMLAttributes,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";

type PrimitiveSize = "sm" | "md" | "lg";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "success";
export type ButtonSize = PrimitiveSize | "icon";

type ButtonBaseProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  children?: ReactNode;
  className?: string;
};

type ButtonAsButtonProps = ButtonBaseProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof ButtonBaseProps | "className"> & {
    href?: undefined;
  };

type ButtonAsAnchorProps = ButtonBaseProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof ButtonBaseProps | "className" | "href"> & {
    href: string;
  };

export type ButtonProps = ButtonAsButtonProps | ButtonAsAnchorProps;

export function Button({
  variant = "secondary",
  size = "md",
  loading = false,
  leftIcon,
  rightIcon,
  children,
  className,
  ...props
}: ButtonProps) {
  const content = (
    <>
      {loading ? <span className="artificio-button-spinner" aria-hidden="true" /> : leftIcon}
      {children ? <span className="artificio-button-label">{children}</span> : null}
      {rightIcon}
    </>
  );
  const buttonClassName = cx(
    "artificio-button",
    `artificio-button-${variant}`,
    `artificio-button-${size}`,
    loading && "artificio-button-loading",
    className,
  );

  if ("href" in props && props.href) {
    const anchorProps = props as Omit<ButtonAsAnchorProps, keyof ButtonBaseProps | "className">;
    return (
      <a className={buttonClassName} aria-busy={loading || undefined} {...anchorProps}>
        {content}
      </a>
    );
  }

  const buttonProps = props as Omit<ButtonAsButtonProps, keyof ButtonBaseProps | "className">;
  return (
    <button
      {...buttonProps}
      className={buttonClassName}
      aria-busy={loading || undefined}
      disabled={loading || buttonProps.disabled}
    >
      {content}
    </button>
  );
}

export type BadgeVariant =
  | "neutral"
  | "brand"
  | "success"
  | "warning"
  | "danger"
  | "info";

export interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

export type BannerVariant = "success" | "warning" | "danger" | "info" | "neutral";

export interface BannerProps {
  children: ReactNode;
  variant?: BannerVariant;
  icon?: ReactNode;
  className?: string;
}

export function Banner({ children, variant = "neutral", icon, className }: BannerProps) {
  return (
    <div className={cx("artificio-banner", `artificio-banner-${variant}`, className)}>
      {icon ? <span className="artificio-banner-icon">{icon}</span> : null}
      <span className="artificio-banner-text">{children}</span>
    </div>
  );
}

export function Badge({ children, variant = "neutral", className }: BadgeProps) {
  return (
    <span className={cx("artificio-badge", `artificio-badge-${variant}`, className)}>
      {children}
    </span>
  );
}

export interface FieldProps {
  id?: string;
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}

export function Field({ id, label, hint, error, required, children, className }: FieldProps) {
  const descriptionId = id ? `${id}-description` : undefined;
  return (
    <div className={cx("artificio-field", className)}>
      <label className="artificio-field-label" htmlFor={id}>
        {label}
        {required ? <span className="artificio-field-required"> *</span> : null}
      </label>
      {children}
      {error ? (
        <p className="artificio-field-error" id={descriptionId} role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="artificio-field-hint" id={descriptionId}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

type ControlStateProps = {
  invalid?: boolean;
  controlSize?: PrimitiveSize;
};

export type TextInputProps = InputHTMLAttributes<HTMLInputElement> & ControlStateProps;

export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(function TextInput({
  className,
  invalid,
  controlSize = "md",
  ...props
}, ref) {
  return (
    <input
      ref={ref}
      className={cx("artificio-control", `artificio-control-${controlSize}`, className)}
      aria-invalid={invalid || undefined}
      data-invalid={invalid ? "true" : undefined}
      {...props}
    />
  );
});

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & ControlStateProps;

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea({
  className,
  invalid,
  controlSize = "md",
  ...props
}, ref) {
  return (
    <textarea
      ref={ref}
      className={cx("artificio-control", "artificio-textarea", `artificio-control-${controlSize}`, className)}
      aria-invalid={invalid || undefined}
      data-invalid={invalid ? "true" : undefined}
      {...props}
    />
  );
});

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & ControlStateProps;

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select({
  className,
  invalid,
  controlSize = "md",
  ...props
}, ref) {
  return (
    <select
      ref={ref}
      className={cx("artificio-control", `artificio-control-${controlSize}`, className)}
      aria-invalid={invalid || undefined}
      data-invalid={invalid ? "true" : undefined}
      {...props}
    />
  );
});

export type PanelTone = "default" | "subtle" | "elevated" | "danger" | "warning";

export interface PanelProps {
  children: ReactNode;
  tone?: PanelTone;
  as?: "section" | "article" | "div";
  header?: ReactNode;
  actions?: ReactNode;
  footer?: ReactNode;
  className?: string;
}

export function Panel({
  children,
  tone = "default",
  as: Component = "section",
  header,
  actions,
  footer,
  className,
}: PanelProps) {
  return (
    <Component className={cx("artificio-panel", `artificio-panel-${tone}`, className)}>
      {header || actions ? (
        <div className="artificio-panel-header">
          <div>{header}</div>
          {actions ? <div className="artificio-panel-actions">{actions}</div> : null}
        </div>
      ) : null}
      <div className="artificio-panel-body">{children}</div>
      {footer ? <div className="artificio-panel-footer">{footer}</div> : null}
    </Component>
  );
}

export interface ToolbarProps {
  children: ReactNode;
  leading?: ReactNode;
  trailing?: ReactNode;
  className?: string;
}

export function Toolbar({ children, leading, trailing, className }: ToolbarProps) {
  return (
    <div className={cx("artificio-toolbar", className)}>
      {leading ? <div className="artificio-toolbar-leading">{leading}</div> : null}
      <div className="artificio-toolbar-content">{children}</div>
      {trailing ? <div className="artificio-toolbar-trailing">{trailing}</div> : null}
    </div>
  );
}

export interface StateProps {
  title?: string;
  message?: string;
  action?: ReactNode;
  variant?: "page" | "panel" | "inline";
  className?: string;
}

function StateBlock({
  title,
  message,
  action,
  variant = "panel",
  className,
  tone,
}: StateProps & { tone: "loading" | "empty" | "error" | "success" }) {
  return (
    <div className={cx("artificio-state", `artificio-state-${variant}`, `artificio-state-${tone}`, className)}>
      {tone === "loading" ? <span className="artificio-state-spinner" aria-hidden="true" /> : null}
      {title ? <h2 className="artificio-state-title">{title}</h2> : null}
      {message ? <p className="artificio-state-message">{message}</p> : null}
      {action ? <div className="artificio-state-action">{action}</div> : null}
    </div>
  );
}

export function LoadingState(props: StateProps) {
  return <StateBlock tone="loading" title="Carregando" {...props} />;
}

export function EmptyState(props: StateProps) {
  return <StateBlock tone="empty" {...props} />;
}

export function ErrorState(props: StateProps) {
  return <StateBlock tone="error" {...props} />;
}

export function SuccessState(props: StateProps) {
  return <StateBlock tone="success" {...props} />;
}

export interface ModalProps {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose?: () => void;
  footer?: ReactNode;
  description?: string;
  closeLabel?: string;
  className?: string;
}

export function Modal({
  open,
  title,
  children,
  onClose,
  footer,
  description,
  closeLabel = "Fechar",
  className,
}: ModalProps) {
  useEscapeClose(open, onClose);
  if (!open) return null;
  const titleId = "artificio-modal-title";
  const descriptionId = description ? "artificio-modal-description" : undefined;

  return (
    <div className="artificio-modal-root">
      <div className="artificio-modal-backdrop" onClick={onClose} />
      <section
        className={cx("artificio-modal", className)}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
      >
        <header className="artificio-modal-header">
          <div>
            <h2 id={titleId} className="artificio-modal-title">
              {title}
            </h2>
            {description ? (
              <p id={descriptionId} className="artificio-modal-description">
                {description}
              </p>
            ) : null}
          </div>
          {onClose ? (
            <button
              type="button"
              className="artificio-modal-close"
              aria-label={closeLabel}
              onClick={onClose}
            >
              ×
            </button>
          ) : null}
        </header>
        <div className="artificio-modal-body">{children}</div>
        {footer ? <footer className="artificio-modal-footer">{footer}</footer> : null}
      </section>
    </div>
  );
}

export interface DrawerProps {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose?: () => void;
  footer?: ReactNode;
  side?: "right" | "left" | "bottom";
  closeLabel?: string;
  className?: string;
}

export function Drawer({
  open,
  title,
  children,
  onClose,
  footer,
  side = "right",
  closeLabel = "Fechar",
  className,
}: DrawerProps) {
  useEscapeClose(open, onClose);
  if (!open) return null;
  const titleId = "artificio-drawer-title";

  return (
    <div className="artificio-drawer-root">
      <div className="artificio-drawer-backdrop" onClick={onClose} />
      <aside
        className={cx("artificio-drawer", `artificio-drawer-${side}`, className)}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <header className="artificio-drawer-header">
          <h2 id={titleId} className="artificio-drawer-title">
            {title}
          </h2>
          {onClose ? (
            <button
              type="button"
              className="artificio-modal-close"
              aria-label={closeLabel}
              onClick={onClose}
            >
              ×
            </button>
          ) : null}
        </header>
        <div className="artificio-drawer-body">{children}</div>
        {footer ? <footer className="artificio-drawer-footer">{footer}</footer> : null}
      </aside>
    </div>
  );
}

function useEscapeClose(open: boolean, onClose?: () => void) {
  useEffect(() => {
    if (!open || !onClose) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose?.();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);
}

export interface HeaderActionProps {
  label: string;
  title?: string;
  badge?: boolean | number;
  disabled?: boolean;
  children: ReactNode;
  onClick?: () => void;
  href?: string;
  className?: string;
}

export function HeaderAction({
  label,
  title,
  badge,
  disabled,
  children,
  onClick,
  href,
  className,
}: HeaderActionProps) {
  const badgeLabel = typeof badge === "number" ? String(badge) : "";
  const content = (
    <>
      {children}
      {badge ? (
        <span
          className={cx(
            "artificio-header-action-badge",
            typeof badge === "number" && "artificio-header-action-badge-count",
          )}
          aria-label={typeof badge === "number" ? `${badge} novos` : "Novo"}
        >
          {badgeLabel}
        </span>
      ) : null}
    </>
  );
  const actionClassName = cx("artificio-header-action", className);

  if (href) {
    return (
      <a
        className={actionClassName}
        aria-label={label}
        aria-disabled={disabled || undefined}
        href={disabled ? undefined : href}
        title={title ?? label}
      >
        {content}
      </a>
    );
  }

  return (
    <button
      className={actionClassName}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      title={title ?? label}
      type="button"
    >
      {content}
    </button>
  );
}
