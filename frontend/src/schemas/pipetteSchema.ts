import { z } from 'zod';
import { PipetteStatus } from '../types';

/**
 * Zod validation schema for Pipette registration.
 */
export const pipetteRegistrationSchema = z.object({
  codigo: z.string().min(1, 'El código es requerido'),
  description: z.string().max(500, 'Máximo 500 caracteres').optional().or(z.literal('')),
  brand: z.string().min(1, 'La marca es requerida'),
  model: z.string().min(1, 'El modelo es requerido'),
  serial_number: z.string().min(1, 'El número de serie es requerido'),
  max_volume: z.union([z.number(), z.string().min(1, 'El volumen máximo es requerido')])
    .transform((val) => (typeof val === 'string' ? parseFloat(val) : val))
    .refine((val) => !isNaN(val) && val > 0, {
      message: 'El volumen máximo debe ser un número positivo',
    }),
  status: z.nativeEnum(PipetteStatus),
});

/**
 * Type inferred from the registration schema.
 */
export type PipetteRegistrationData = z.infer<typeof pipetteRegistrationSchema>;
