interface ToastProps {
  message: string;
  onDismiss: () => void;
}

// Error toast — persists until dismissed so the raw output stays readable.
export function Toast({ message, onDismiss }: ToastProps) {
  return (
    <div className="toast" role="alert">
      <pre className="toast-message">{message}</pre>
      <button
        type="button"
        className="toast-close"
        onClick={onDismiss}
        aria-label="Dismiss"
      >
        ×
      </button>
    </div>
  );
}
