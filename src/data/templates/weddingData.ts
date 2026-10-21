import type { TemplateTask, TemplateVendor } from './types';

export const WEDDING_TASKS: TemplateTask[] = [
  {
    title: 'Book wedding venue and sign contract',
    category: 'venue',
    dueDaysBefore: 180,
    priority: 'high',
  },
  {
    title: 'Finalize catering menu and dietary counts',
    category: 'food',
    dueDaysBefore: 120,
    priority: 'high',
  },
  {
    title: 'Hire lead photographer and videographer',
    category: 'photography',
    dueDaysBefore: 120,
    priority: 'high',
  },
  {
    title: 'Design wedding theme and floral decor layout',
    category: 'decor',
    dueDaysBefore: 90,
    priority: 'medium',
  },
  {
    title: 'Book DJ and event sound equipment',
    category: 'entertainment',
    dueDaysBefore: 90,
    priority: 'medium',
  },
  {
    title: 'Order and dispatch wedding invitations',
    category: 'other',
    dueDaysBefore: 75,
    priority: 'high',
  },
  {
    title: 'Finalize wedding attire and fittings',
    category: 'planning',
    dueDaysBefore: 60,
    priority: 'high',
  },
  {
    title: 'Confirm guest shuttle transportation routes',
    category: 'transport',
    dueDaysBefore: 45,
    priority: 'low',
  },
  {
    title: 'Order personalized return gifts and packaging',
    category: 'gifts',
    dueDaysBefore: 45,
    priority: 'low',
  },
  {
    title: 'Run audio and wireless microphone check',
    category: 'entertainment',
    dueDaysBefore: 30,
    priority: 'medium',
  },
  {
    title: 'Coordinate ceremony schedule with officiant',
    category: 'planning',
    dueDaysBefore: 21,
    priority: 'high',
  },
  {
    title: 'Perform final venue walkthrough and seating setup',
    category: 'venue',
    dueDaysBefore: 14,
    priority: 'high',
  },
  {
    title: 'Deliver final confirmed guest headcount to caterer',
    category: 'food',
    dueDaysBefore: 7,
    priority: 'high',
  },
  {
    title: 'Prepare day-of vendor cash disbursement envelopes',
    category: 'finance',
    dueDaysBefore: 3,
    priority: 'high',
  },
  {
    title: 'Assemble wedding day emergency care kit',
    category: 'planning',
    dueDaysBefore: 1,
    priority: 'medium',
  },
];

export const WEDDING_VENDORS: TemplateVendor[] = [
  {
    category: 'venue',
    requirements: [
      'Dedicated air-conditioned bridal green room',
      'Continuous power backup generator minimum 60 kVA',
      'Valet parking arrangement for up to 100 vehicles',
      'Early setup access 6 hours prior to start',
      'On-site security personnel at entry points',
    ],
    questionsToAsk: [
      'Are there strict noise curfews or decibel limits after 10 PM?',
      'Do you charge additional fees or royalty for outside vendors?',
      'What is your written cancellation and postponement policy?',
      'Are cleaning fees and utility charges included in this quote?',
      'Will a dedicated venue manager be present on event day?',
      'What is the venue policy regarding floral hanging fixtures?',
    ],
  },
  {
    category: 'food',
    requirements: [
      'Live starter counters and beverage stations',
      'Strict separate kitchen line for Jain and vegetarian food',
      'Staffing ratio of at least 1 server per 20 guests',
      'Continuous hot buffet maintenance with chafing fuel',
      'Hygienic drinking water dispensers and clean ice',
    ],
    questionsToAsk: [
      'Do you offer a comprehensive pre-event tasting session?',
      'What happens to surplus prepared food at the event end?',
      'Are premium crockery, glassware, and cloth linen provided?',
      'How do you accommodate surprise last-minute guest additions?',
      'Do your servers manage full table bussing and waste removal?',
      'Are all food preparation licenses up to date?',
    ],
  },
  {
    category: 'decor',
    requirements: [
      'Grand floral backdrop tailored to theme palette',
      'Entrance archway with personalized welcome signage',
      'Table floral centerpieces and coordinated chair covers',
      'Warm LED uplighting and spotlighting for ceremony area',
      'Complete teardown and hall cleanup within 3 hours',
    ],
    questionsToAsk: [
      'Are fresh local blooms used or artificial silk arrangements?',
      'Can you provide photographic proof of setups at this specific venue?',
      'What is the precise breakdown between floral and structure costs?',
      'Do you bring backup lighting transformers on site?',
      'Are structural hanging brackets certified for safety?',
      'What deposit percentage locks in the requested wedding date?',
    ],
  },
  {
    category: 'photography',
    requirements: [
      'Two candid photographers and one cinematic videographer',
      'Ten hours continuous wedding day coverage',
      'Raw image archive delivered on physical storage media',
      'One-minute highlight teaser delivered within 7 days',
      'Full edited cinematic film delivered within 30 days',
    ],
    questionsToAsk: [
      'Will the lead photographer shown in portfolio attend in person?',
      'What redundant cameras and memory cards do you operate?',
      'What is the specific hourly rate for overtime extensions?',
      'How many fully retouched high-resolution images are delivered?',
      'Do we receive unrestricted printing and non-commercial rights?',
      'What album binding options and paper weights are included?',
    ],
  },
  {
    category: 'entertainment',
    requirements: [
      'Professional wedding DJ with bilingual emceeing skills',
      'JBL or equivalent sound system calibrated for the venue',
      'Three cordless UHF handheld microphones with fresh batteries',
      'Pre-curated playlist featuring requested cultural tracks',
      'Sound engineering check completed 2 hours before arrival',
    ],
    questionsToAsk: [
      'Do you hold valid public performance and music playback licenses?',
      'Can our family submit a strict do-not-play track list?',
      'What backup audio console or playback device is on standby?',
      'Do you provide lapel microphones for the ceremony rituals?',
      'Are sound technician travel and logistics included?',
      'How do you manage spontaneous guest song requests during dance sets?',
    ],
  },
];
