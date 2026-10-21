'use client';

import {
  useEffect,
  useId,
  useRef,
  type ReactNode,
} from 'react';

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}

export interface DrawerProps extends DialogProps {
  placement?: 'bottom' | 'right';
}

/**
 * Accessible modal primitive built on the native HTML `<dialog>` element.
 *
 * ACCESSIBILITY DECISION (WHY):
 * 1. Native showModal() provides out-of-the-box browser-level modal accessibility, inerting background DOM.
 * 2. Focus Return: Saves `document.activeElement` on open and returns focus to the trigger upon closing.
 * 3. Escape to close: Handled natively via the `cancel` event, mapped directly to `onClose`.
 * 4. Title Labeling: Guarantees `aria-labelledby` ties directly to the modal title.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  className = '',
}: DialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open) {
      previouslyFocusedRef.current = document.activeElement as HTMLElement | null;
      if (!dialog.open) {
        dialog.showModal();
      }
      document.body.style.overflow = 'hidden';
    } else {
      if (dialog.open) {
        dialog.close();
      }
      document.body.style.overflow = '';
      previouslyFocusedRef.current?.focus();
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        // Close when clicking the native backdrop pseudo-element
        if (e.target === dialogRef.current) {
          onClose();
        }
      }}
      className={`fixed inset-0 m-auto max-w-lg w-[calc(100%-2rem)] p-0 bg-transparent backdrop:bg-[#2B1B2E]/60 backdrop:backdrop-blur-xs open:animate-in open:fade-in open:zoom-in-95 ${className}`}
    >
      <div className="bg-white rounded-[20px] border border-[#E6DCD2] shadow-2xl p-6 overflow-hidden">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h2 id={titleId} className="font-serif text-xl font-bold text-[#2B1B2E]">
              {title}
            </h2>
            {description ? (
              <p id={descriptionId} className="text-sm text-[#5B4A5E] mt-1">
                {description}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="p-1.5 rounded-full text-[#5B4A5E] hover:text-[#2B1B2E] hover:bg-[#F4EDE6] cursor-pointer"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div className="text-[#2B1B2E]">{children}</div>
      </div>
    </dialog>
  );
}

/**
 * Drawer primitive reusing native dialog foundation for side and bottom sheets.
 */
export function Drawer({
  open,
  onClose,
  title,
  description,
  placement = 'right',
  children,
  className = '',
}: DrawerProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open) {
      previouslyFocusedRef.current = document.activeElement as HTMLElement | null;
      if (!dialog.open) {
        dialog.showModal();
      }
      document.body.style.overflow = 'hidden';
    } else {
      if (dialog.open) {
        dialog.close();
      }
      document.body.style.overflow = '';
      previouslyFocusedRef.current?.focus();
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  const placementClasses =
    placement === 'bottom'
      ? 'bottom-0 left-0 right-0 top-auto m-0 w-full max-w-none rounded-t-[20px] rounded-b-none'
      : 'top-0 right-0 bottom-0 left-auto m-0 h-full max-w-md w-full rounded-l-[20px] rounded-r-none';

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === dialogRef.current) {
          onClose();
        }
      }}
      className={`fixed p-0 bg-transparent backdrop:bg-[#2B1B2E]/60 backdrop:backdrop-blur-xs ${placementClasses} ${className}`}
    >
      <div className="bg-white h-full p-6 flex flex-col overflow-y-auto">
        <div className="flex items-start justify-between gap-4 mb-4 pb-3 border-b border-[#E6DCD2]">
          <div>
            <h2 id={titleId} className="font-serif text-xl font-bold text-[#2B1B2E]">
              {title}
            </h2>
            {description ? (
              <p id={descriptionId} className="text-sm text-[#5B4A5E] mt-1">
                {description}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close drawer"
            className="p-1.5 rounded-full text-[#5B4A5E] hover:text-[#2B1B2E] hover:bg-[#F4EDE6] cursor-pointer"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div className="flex-1 text-[#2B1B2E]">{children}</div>
      </div>
    </dialog>
  );
}
