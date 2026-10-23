import { z } from 'zod';

export const contactSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(80),
  role: z.string().max(60).optional(),
  phone: z
    .string()
    .max(20)
    .regex(/^[+\d][\d\s\-()]{3,19}$/)
    .optional(),
  category: z.string().max(60).optional(),
  note: z.string().max(200).optional(),
});

export type Contact = z.infer<typeof contactSchema>;
