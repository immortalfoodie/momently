'use client';

import { useMemo, useState } from 'react';
import type { Contact } from '@/domain/contactSchemas';
import type { EventPlan } from '@/domain/types';
import { contactsGroupedByCategory } from '@/engine/eventDay';
import { useAnnouncer } from '@/components/ui/LiveRegion';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Dialog } from '@/components/ui/Dialog';
import { useEventsStore } from '@/store/eventsStore';
import { ContactDialog } from './ContactDialog';

export interface ContactsPanelProps {
  plan: EventPlan;
  eventId: string;
  className?: string;
}

function ContactCard({
  contact,
  onCopyPhone,
  onEdit,
  onRemove,
}: {
  contact: Contact;
  onCopyPhone: (contact: Contact) => void;
  onEdit: (contact: Contact) => void;
  onRemove: (contact: Contact) => void;
}) {
  return (
    <Card className="p-4 bg-white border border-[#E6DCD2] space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="font-semibold text-base text-[#2B1B2E]">{contact.name}</h4>
          {contact.role && <p className="text-sm text-[#5B4A5E]">{contact.role}</p>}
          {contact.note && <p className="text-xs text-[#7A6B7E] mt-1">{contact.note}</p>}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button variant="ghost" size="sm" onClick={() => onEdit(contact)} className="min-h-[44px]">
            Edit
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onRemove(contact)} className="min-h-[44px] text-[#A82B35]">
            Remove
          </Button>
        </div>
      </div>

      {contact.phone && (
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#E6DCD2]">
          <a
            href={`tel:${contact.phone}`}
            aria-label={`Call ${contact.name}`}
            className="min-h-[44px] px-3.5 py-2 inline-flex items-center rounded-[12px] bg-[#F5F2EB] text-[#2B1B2E] font-medium text-sm hover:bg-[#EFE9DF] transition-colors"
          >
            {contact.phone}
          </a>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onCopyPhone(contact)}
            aria-label={`Copy phone number for ${contact.name}`}
            className="min-h-[44px]"
          >
            Copy number
          </Button>
        </div>
      )}
    </Card>
  );
}

function RemoveContactDialog({
  contact,
  open,
  onClose,
  onConfirm,
}: {
  contact: Contact | null;
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Remove Contact?"
      description="Are you sure you want to remove this contact?"
    >
      <div className="space-y-4 py-2">
        <p className="text-sm text-[#5B4A5E]">
          Removing &ldquo;{contact?.name}&rdquo; from your browser storage cannot be undone.
        </p>
        <div className="flex justify-end gap-2 pt-2 border-t border-[#E6DCD2]">
          <Button variant="ghost" onClick={onClose} className="min-h-[44px]">
            Cancel
          </Button>
          <Button variant="danger" onClick={onConfirm} className="min-h-[44px]">
            Confirm Remove
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

const EMPTY_CONTACTS: Contact[] = [];

export function ContactsPanel({ plan, eventId, className = '' }: ContactsPanelProps) {
  const { announce } = useAnnouncer();
  const eventRecord = useEventsStore((s) => s.events[eventId]);
  const addContact = useEventsStore((s) => s.addContact);
  const updateContact = useEventsStore((s) => s.updateContact);
  const removeContact = useEventsStore((s) => s.removeContact);

  const contacts = eventRecord?.contacts ?? EMPTY_CONTACTS;
  const groups = useMemo(() => contactsGroupedByCategory(contacts), [contacts]);
  const vendorCategories = useMemo(
    () => Array.from(new Set(plan.budgetItems.map((it) => it.category))).sort(),
    [plan.budgetItems],
  );

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [removingContact, setRemovingContact] = useState<Contact | null>(null);

  const handleCopyPhone = async (contact: Contact) => {
    if (!contact.phone) return;
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(contact.phone);
        announce(`Copied phone number for ${contact.name}`);
      }
    } catch {
      announce(`Phone number: ${contact.phone}`);
    }
  };

  const handleSaveContact = (saved: Contact) => {
    if (editingContact) {
      updateContact(eventId, saved.id, saved);
      announce(`Updated contact ${saved.name}`);
    } else {
      addContact(eventId, saved);
      announce(`Added contact ${saved.name}`);
    }
    setEditingContact(null);
  };

  const handleConfirmRemove = () => {
    if (removingContact) {
      removeContact(eventId, removingContact.id);
      announce(`Removed contact ${removingContact.name}`);
      setRemovingContact(null);
    }
  };

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-[#7A6B7E]">
          Contacts stay in this browser. They are never sent to the AI or to any server.
        </p>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            setEditingContact(null);
            setDialogOpen(true);
          }}
          className="min-h-[44px] shrink-0"
        >
          Add contact
        </Button>
      </div>

      {contacts.length === 0 ? (
        <Card className="p-6 bg-white border border-[#E6DCD2] text-center space-y-3">
          <p className="text-base font-semibold text-[#2B1B2E]">
            Add the people you&apos;d call on the day: caterer, photographer, venue manager
          </p>
          <Button variant="primary" onClick={() => { setEditingContact(null); setDialogOpen(true); }} className="min-h-[44px]">
            Add a contact
          </Button>
        </Card>
      ) : (
        <div className="space-y-6">
          {groups.map((group) => (
            <div key={group.category} className="space-y-2">
              <h3 className="text-sm font-bold text-[#5B4A5E] uppercase tracking-wider">{group.category}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {group.contacts.map((c) => (
                  <ContactCard
                    key={c.id}
                    contact={c}
                    onCopyPhone={handleCopyPhone}
                    onEdit={(contact) => { setEditingContact(contact); setDialogOpen(true); }}
                    onRemove={(contact) => setRemovingContact(contact)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {dialogOpen && (
        <ContactDialog
          open={dialogOpen}
          contact={editingContact}
          vendorCategories={vendorCategories}
          onClose={() => { setDialogOpen(false); setEditingContact(null); }}
          onSave={handleSaveContact}
        />
      )}

      {removingContact && (
        <RemoveContactDialog
          contact={removingContact}
          open={Boolean(removingContact)}
          onClose={() => setRemovingContact(null)}
          onConfirm={handleConfirmRemove}
        />
      )}
    </div>
  );
}
