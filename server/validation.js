import { z } from 'zod';

export const CAMPAIGN_ID_PATTERN = /^[A-Za-z0-9_-]+$/;

function isHttpUrl(value) {
  try {
    const url = new URL(value);
    return (url.protocol === 'http:' || url.protocol === 'https:') && Boolean(url.hostname);
  } catch {
    return false;
  }
}

const status = z.enum(['active', 'paused'], {
  errorMap: () => ({ message: 'Status must be active or paused' }),
});

export const campaignSchema = z.object({
  name: z
    .string({ required_error: 'Campaign name is required' })
    .trim()
    .min(1, 'Campaign name is required')
    .max(120, 'Keep the name under 120 characters'),
  campaignId: z
    .string({ required_error: 'Campaign ID is required' })
    .trim()
    .min(2, 'Campaign ID needs at least 2 characters')
    .max(50, 'Keep the campaign ID under 50 characters')
    .regex(CAMPAIGN_ID_PATTERN, 'Use letters, numbers, hyphens or underscores only')
    .transform((v) => v.toUpperCase()),
  destinationUrl: z
    .string({ required_error: 'Destination URL is required' })
    .trim()
    .max(2048, 'Destination URL is too long')
    .refine(isHttpUrl, 'Enter a full URL starting with http:// or https://'),
  status: status.default('active'),
});

export const statusSchema = z.object({ status });

/** Parses input or throws a 400 with per-field messages the UI can show inline. */
export function parse(schema, input) {
  const result = schema.safeParse(input ?? {});
  if (result.success) return result.data;
  const fields = {};
  for (const issue of result.error.issues) {
    const key = issue.path[0] ?? 'form';
    fields[key] ??= issue.message;
  }
  const err = new Error('Please fix the highlighted fields');
  err.status = 400;
  err.fields = fields;
  throw err;
}
