import { useEffect } from 'react';
import { useNotifications, type Toast } from './notificationsStore';
import { Icon } from '../art/UiIcon';

export function Notifications() {
  const items = useNotifications((s) => s.items);
  return (
    <div className="toasts" role="status" aria-live="polite" aria-atomic="false">
      {items.map((t) => (
        <ToastItem key={t.id} toast={t} />
      ))}
    </div>
  );
}

function ToastItem({ toast }: { toast: Toast }) {
  const dismiss = useNotifications((s) => s.dismiss);
  useEffect(() => {
    const h = setTimeout(() => dismiss(toast.id), 4200);
    return () => clearTimeout(h);
  }, [toast.id, dismiss]);
  return (
    <button className={`toast toast--${toast.tone}`} onClick={() => dismiss(toast.id)}>
      <Icon name={toast.icon} size={16} />
      <span>{toast.text}</span>
    </button>
  );
}
