import React from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";

export default function FloatingCreateButton({
  to,
  title,
  className,
  children,
}) {
  if (typeof document === "undefined") return null;
  const style = {
    position: "fixed",
    bottom: "16px",
    right: "16px",
    zIndex: 2147483647,
    pointerEvents: "auto",
  };
  const content = (
    <div style={style}>
      <Link
        to={to}
        title={title}
        className={
          className ||
          "btn-success inline-flex rounded-full w-12 h-12 shadow-erp-lg items-center justify-center text-xl"
        }
      >
        {children || "+"}
      </Link>
    </div>
  );
  return createPortal(content, document.body);
}
