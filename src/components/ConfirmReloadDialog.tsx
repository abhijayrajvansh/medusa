"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useEffect } from "react";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onConfirm: () => void;
  title?: string;
  description?: string;
  confirmLabel?: string;
};

export default function ConfirmReloadDialog({ open, onOpenChange, onConfirm, title, description, confirmLabel }: Props) {
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(540px,calc(100vw-2rem))] rounded-xl border border-neutral-700 bg-neutral-900 text-neutral-50 p-4 shadow-xl">
          <Dialog.Title className="font-bold mb-1">
            {title ?? 'Leave session?'}
          </Dialog.Title>
          <Dialog.Description className="opacity-90 mb-3">
            {description ?? 'Reloading or closing will terminate the active SSH session. Are you sure you want to continue?'}
          </Dialog.Description>
          <div className="flex justify-end gap-2 mt-2">
            <button className="px-3 py-2 rounded-md border border-neutral-700 bg-transparent hover:bg-neutral-800" onClick={() => onOpenChange(false)}>Cancel</button>
            <button className="px-3 py-2 rounded-md border border-red-600 bg-red-500 text-white hover:bg-red-400" onClick={onConfirm}>{confirmLabel ?? 'Reload'}</button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

