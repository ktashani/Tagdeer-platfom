# Tagdeer Platform | منصة تقدير

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![React](https://img.shields.io/badge/React-19.2.0-blue.svg)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Vite-7.2.4-purple.svg)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4.19-cyan.svg)](https://tailwindcss.com/)
[![Supabase](https://img.shields.io/badge/Supabase-2.49.1-green.svg)](https://supabase.io/)

**Tagdeer** is a Libyan business evaluation and rewards platform where authentic experiences build a trusted community, and loyalty earns real value across Tripoli and Benghazi.

> **تقدير** - أعطيهم تقديرك، واكسب قَدْرك

## Features

- **Business Discovery**: Find and evaluate local businesses in Tripoli and Benghazi
- **Community-Driven Reviews**: Share authentic experiences and help others make informed decisions
- **Gader Score System**: Businesses earn reputation based on community feedback
- **Shield Protection**: Premium businesses can activate shields to prevent fake reviews
- **Bilingual Support**: Full Arabic and English language support with RTL layout
- **Anonymous Voting**: Up to 3 anonymous reviews per week per user
- **Business Pre-registration**: Early access program for business owners

## Tech Stack

- **Frontend**: React 19 + Vite 7
- **Styling**: Tailwind CSS 3.4 + shadcn/ui components
- **Backend**: Supabase (PostgreSQL + Auth + Realtime)
- **Icons**: Lucide React
- **State Management**: React Hooks
- **i18n**: Custom translation system 

## Project Structure

```
tagdeer-platform/
├── .github/              # CI/CD Workflows
├── public/               # Static Assets
│   ├── favicon.ico
│   └── logo-tagdeer.svg
├── src/
│   ├── components/       # Reusable UI Components
│   │   ├── Hero/
│   │   ├── Navigation/
│   │   ├── Modals/
│   │   └── Toast.jsx
│   ├── hooks/            # Custom React Hooks
│   │   └── useSupabase.js
│   ├── i18n/             # Translation Files
│   │   └── translations.js
│   ├── lib/              # Third-party configurations
│   │   └── supabaseClient.js
│   ├── utils/            # Helper functions
│   │   └── slugify.js
│   ├── App.jsx           # Main Application Component
│   ├── App.css           # Custom Styles
│   ├── index.css         # Tailwind Imports & Global Styles
│   └── main.jsx          # React Entry Point
├── supabase/
│   └── migrations/       # Database Schema
├── .env.example          # Environment Variables Template
├── index.html
├── package.json
├── tailwind.config.js
└── vite.config.js
```

## Getting Started

### Prerequisites

- Node.js 20+
- npm or yarn
- Supabase account (free tier works)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/tagdeer-platform.git
   cd tagdeer-platform
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```
   Edit `.env` and add your Supabase credentials:
   ```
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```

4. **Set up Supabase Database**
   - Create a new Supabase project
   - Run the SQL migration in `supabase/migrations/20260222_schema.sql`
   - Enable Row Level Security (RLS) policies

5. **Start development server**
   ```bash
   npm run dev
   ```

6. **Build for production**
   ```bash
   npm run build
   ```

## Database Schema

### Tables

- **businesses**: Store business information
- **interactions**: User reviews and ratings
- **pre_registrations**: Business owner pre-registration requests
- **verified_users**: Phone-verified user accounts
- **business_claims**: Business ownership claims

### Key Features

- Row Level Security (RLS) enabled
- Automatic health score calculation
- Indexed for performance
- Sample data included

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `VITE_SUPABASE_URL` | Your Supabase project URL | Yes |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase anon key | Yes |
| `VITE_GOOGLE_PLACES_API_KEY` | Google Places API (optional) | No |
| `VITE_FACEBOOK_APP_ID` | Facebook App ID (optional) | No |

## Deployment

### StackBlitz

1. Import your GitHub repository to StackBlitz
2. Add environment variables in StackBlitz settings
3. The app will auto-deploy

### Vercel

1. Connect your GitHub repository to Vercel
2. Add environment variables in Vercel dashboard
3. Deploy with zero configuration

### Netlify

1. Connect your GitHub repository to Netlify
2. Set build command: `npm run build`
3. Set publish directory: `dist`
4. Add environment variables

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Roadmap

- [ ] Phone verification system
- [ ] Loyalty points and rewards
- [ ] Business dashboard
- [ ] Receipt upload for shielded complaints
- [ ] Mobile app (React Native)
- [ ] AI-powered review analysis
- [ ] Multi-city expansion

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [shadcn/ui](https://ui.shadcn.com/) for beautiful UI components
- [Supabase](https://supabase.io/) for backend infrastructure
- [Tailwind CSS](https://tailwindcss.com/) for styling
- [Lucide](https://lucide.dev/) for icons

## Contact

- Website: [tagdeer.ly](https://tagdeer.ly)
- Email: hello@tagdeer.ly
- Facebook: [@tagdeerly](https://facebook.com/tagdeerly)

---

<p align="center">
  Made with ❤️ in Libya
</p>
