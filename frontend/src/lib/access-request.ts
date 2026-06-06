export const REQUEST_COOLDOWN_DAYS = 7

export const MIN_REQUEST_MESSAGE = 10
export const MAX_REQUEST_MESSAGE = 500

export const MIN_DISMISS_REASON = 5
export const MAX_DISMISS_REASON = 500

export const DISMISS_REASON_TEMPLATES = [
  'Insufficient justification — please share a more specific use case.',
  'Quota limit reached — try again when capacity opens up.',
  'Account too new — please build some reading history first.',
  'Will revisit later — check back after the next platform update.',
] as const
