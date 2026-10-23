'use client';

import { useState } from 'react';
import type { Contact } from '@/domain/contactSchemas';
import { contactSchema } from '@/domain/contactSchemas';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Field } from '@/components/ui/Field';
import { Select } from '@/components/ui/Select';
import { TextArea } from '@/components/ui/TextArea';
import { TextInput } from '@/components/ui/TextInput';
import { engineContext } from '@/store/engineContext';

export interface ContactDialogProps {
  open: boolean;
  onClose: () => void;
  contact?: Contact | null;
  vendorCategories: string[];
  onSave: (contact: Contact) => void;
}

function initialFormValues(contact?: Contact | null, defaultCategory = 'Other') {
  if (contact) {
    return {
      name: contact.name,
      role: contact.role ?? '',
      phone: contact.phone ?? '',
      category: contact.category ?? defaultCategory,
      note: contact.note ?? '',
    };
  }
  return {
    name: '',
    role: '',
    phone: '',
    category: defaultCategory,
    note: '',
  };
}

export function ContactDialog({
  open,
  onClose,
  contact,
  vendorCategories,
  onSave,
}: ContactDialogProps) {
  const isEditing = Boolean(contact);
  const categories = Array.from(new Set([...vendorCategories, 'Other'])).sort();
  const init = initialFormValues(contact, categories[0] ?? 'Other');

  const [name, setName] = useState(init.name);
  const [role, setRole] = useState(init.role);
  const [phone, setPhone] = useState(init.phone);
  const [category, setCategory] = useState(init.category);
  const [note, setNote] = useState(init.note);
  const [error, setError] = useState<string | null>(null);

  const handleSave = () => {
    const trimmedName = name.trim();
    const trimmedRole = role.trim() || undefined;
    const trimmedPhone = phone.trim() || undefined;
    const trimmedCategory = category.trim() || undefined;
    const trimmedNote = note.trim() || undefined;

    const candidate: Contact = {
      id: contact?.id || engineContext.ids('contact'),
      name: trimmedName,
      role: trimmedRole,
      phone: trimmedPhone,
      category: trimmedCategory,
      note: trimmedNote,
    };

    const res = contactSchema.safeParse(candidate);
    if (!res.success) {
      const issue = res.error.issues[0];
      const msg = issue?.message ?? 'Please check contact fields.';
      setError(msg);
      return;
    }

    onSave(res.data);
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isEditing ? 'Edit Contact' : 'Add Contact'}
      description="Add or update key event-day emergency numbers and staff details."
    >
      <div className="space-y-4 py-2">
        {error && <Alert tone="danger">{error}</Alert>}

        <Field label="Contact Name" required>
          <TextInput
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Ramesh Sharma"
            maxLength={80}
            required
          />
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Role">
            <TextInput
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="e.g. Catering Head"
              maxLength={60}
            />
          </Field>

          <Field label="Category">
            <Select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              aria-label="Contact category"
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label="Phone number">
          <input
            id="contact-phone-input"
            aria-label="Phone number"
            type="tel"
            inputMode="tel"
            autoComplete="off"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="e.g. +91 98765 43210"
            className="w-full min-h-[44px] px-3.5 py-2 rounded-[12px] border border-[#E6DCD2] bg-white text-[#2B1B2E] text-base"
          />
        </Field>

        <Field label="Note (optional)">
          <TextArea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={200}
            placeholder="e.g. Use Gate 2 for equipment drop-off"
          />
        </Field>

        <div className="flex justify-end gap-2 pt-3 border-t border-[#E6DCD2]">
          <Button variant="ghost" onClick={onClose} className="min-h-[44px]">
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSave} className="min-h-[44px]">
            {isEditing ? 'Save changes' : 'Save contact'}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
