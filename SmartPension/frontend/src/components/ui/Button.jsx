import { forwardRef } from "react";
import { Link } from "react-router-dom";
import { Loader2 } from "lucide-react";

/**
 * Button – variants: primary | secondary | accent | outline | ghost | danger; sizes: sm | md | lg.
 * Pass `to` to render a router Link styled as a button.
 */
const Button = forwardRef(function Button(
  { variant = "primary", size = "md", loading = false, icon: Icon, iconRight: IconRight, block, iconOnly,
    to, className = "", children, disabled, type = "button", ...props },
  ref
) {
  const classes = [
    "btn", `btn--${variant}`, size !== "md" && `btn--${size}`, block && "btn--block", iconOnly && "btn--icon", className,
  ].filter(Boolean).join(" ");
  const iconSize = size === "sm" ? 16 : 18;
  const content = (
    <>
      {loading ? <Loader2 size={iconSize} className="spin" aria-hidden /> : Icon && <Icon size={iconSize} aria-hidden />}
      {children}
      {IconRight && !loading && <IconRight size={iconSize} aria-hidden />}
    </>
  );

  if (to && !disabled) {
    return <Link ref={ref} to={to} className={classes} {...props}>{content}</Link>;
  }
  return (
    <button ref={ref} type={type} className={classes} disabled={disabled || loading} aria-busy={loading || undefined} {...props}>
      {content}
    </button>
  );
});

export default Button;
