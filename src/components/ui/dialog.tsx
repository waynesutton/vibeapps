import React from "react";

const DialogComponent = ({
  open,
  onOpenChange,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}) => {
  if (!open) return null;
  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
      }}>
      <div
        style={{
          background: "white",
          padding: "20px",
          borderRadius: "8px",
          minWidth: "300px",
          maxWidth: "500px",
          boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
        }}>
        {children}
      </div>
    </div>
  );
};

const DialogContentComponent = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => <div className={className}>{children}</div>;

const DialogHeaderComponent = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => <div className={`mb-4 ${className || ""}`}>{children}</div>;

const DialogTitleComponent = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => <h2 className={`text-lg font-medium ${className || ""}`}>{children}</h2>;

const DialogFooterComponent = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => <div className={`mt-6 flex justify-end gap-2 ${className || ""}`}>{children}</div>;

const DialogCloseComponent = ({
  children,
  asChild,
  onClick,
}: {
  children: React.ReactNode;
  asChild?: boolean;
  onClick?: () => void;
}) => {
  const handleClick = () => {
    if (onClick) {
      onClick();
    }
  };
  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children, {
      onClick: handleClick,
    } as React.HTMLAttributes<HTMLElement>);
  }
  return (
    <button type="button" onClick={handleClick}>
      {children}
    </button>
  );
};

export {
  DialogComponent as Dialog,
  DialogContentComponent as DialogContent,
  DialogHeaderComponent as DialogHeader,
  DialogTitleComponent as DialogTitle,
  DialogFooterComponent as DialogFooter,
  DialogCloseComponent as DialogClose,
};
