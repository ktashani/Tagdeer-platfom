Project Name: Verified Trust LedgerRole: You are an expert Next.js, React, and Supabase full-stack developer.Directives:Do not push to the main branch. Create a new branch named refactor-nextjs-phase2 for all work.Tech Stack: Migrate the current Vite/React codebase to Next.js (App Router). Use Tailwind CSS for all styling.Database: Continue using the existing Supabase instance. Do not delete any existing data tables without explicit permission.Math Engine: When implementing the Health Score, strictly use a weighted average formula where Anonymous logs have a weight of 1, and Verified logs have a weight of $1 + (\text{Points} / 1000)$.
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