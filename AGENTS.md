Project Name: Verified Trust LedgerRole: You are an expert Next.js, React, and Supabase full-stack developer.Directives:Do not push to the main branch. Create a new branch named refactor-nextjs-phase2 for all work.Tech Stack: Migrate the current Vite/React codebase to Next.js (App Router). Use Tailwind CSS for all styling.Database: Continue using the existing Supabase instance. Do not delete any existing data tables without explicit permission.Math Engine: When implementing the Gader Index, use tier-based multipliers: Anonymous logs have a weight of 0.25. Verified logs use tier multipliers — Bronze (0-999 Gader): 1.0x, Silver (1000-4999): 1.5x, Gold (5000-19999): 2.0x, VIP (20000+): 2.5x. Diminishing returns apply for repeated votes on the same business within 30 days (1st: 1.0, 2nd: 0.5, 3rd+: 0.25).
Brand Persona & Localization Dictionary (The "Tagdeer" Protocol)
Core Identity: > This platform is not a generic Silicon Valley SaaS product. It is deeply rooted in Libyan cultural psychology, specifically the Arabic root (ق - د - ر). The brand persona is the "Fair Judge" and the "Fierce Protector." It is a system built by Libyans, for Libyans, based on mutual respect, trust, and generosity.

AI Coding & Copywriting Rule: > AI agents must NEVER use generic western review terminology (e.g., "Health Score", "Trust Points", "5-Star Rating") in the UI, translation files, or variable names if a local equivalent exists. Always use the following dictionary:

The Glossary:

Tagdeer (تقدير): The Brand Name and the Action. Used instead of "Review" or "Evaluation." Users don't leave reviews; they give their Tagdeer.

Gader (قَدْر): The Currency of Trust. Used instead of "Trust Points." (e.g., A user earns "50 Gader", not "50 Points").

Gader Index (مؤشر القدر): Used instead of "Health Score" or "Business Rating." This is the calculated reputation of a business.

Migdar (مقدار): The Measure. Used for UI elements like progress bars, tier trackers, or the ratio of positive/negative logs.

Slogan: "أعطيهم تقديرك، واكسب قدرك" (Give them your evaluation, and earn your value/rewards).

When generating UI components or updating state context, agents should map these concepts directly into the Arabic i18n files and use corresponding English variable names (e.g., gaderIndex, userGader) to maintain alignment between the code and the brand.

Security, Traceability & Governance
1. Anonymous Traceability (Shadow Profiles):

For unverified users, use Fingerprinting (Device info + IP Hash + LocalStorage UUID) to anchor logs.

Log Limits: Unverified devices are limited to 5 logs per 24 hours.

Business Creation: Any authenticated user can create community directory listings.

2. Content Integrity (The Judge):

Implement a Bad Word Dictionary filter for all logs.

If a log contains prohibited slang or harassment, it must be flagged for review and not impact the Gader Index until cleared.

3. Business Scanning (The Digital Gader Card):

The QR code scan must resolve to a Business-Facing Preview.

This preview shows the user's Profile Picture, Gader Points, and VIP Tier.

It includes a "Grant Recognition" button for the business owner to award coupons.

4. Quality Assurance & Automated Testing:

NEVER finalize a component without ensuring all imports are present.

Before claiming a feature is complete, you must write a basic Unit/Component test (using Vitest/Jest and React Testing Library) to verify that the component mounts without crashing and that core state interactions (like clicking save) behave as expected.