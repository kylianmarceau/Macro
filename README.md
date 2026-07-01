# Macro

Macro is a signed-in calorie and macro tracker built with vinext, React, D1,
Gemini, and USDA FoodData Central.

## Features

- ChatGPT sign-in with per-user profiles, meals, and weight logs
- AI-assisted meal parsing from plain text
- USDA-backed calorie and macro estimates
- Maintenance and target calories using Mifflin-St Jeor
- Daily calorie and weight charts
- Editable meal estimates before saving

## Local Setup

```bash
npm install
cp .env.example .env
npm run db:generate
npm run dev
```

Add real keys to `.env` for meal estimation:

```bash
GEMINI_API_KEY=...
USDA_API_KEY=...
DEV_AUTH_EMAIL=dev@example.com
```

`DEV_AUTH_EMAIL` is only used outside production so local development can use
the tracker without the hosted ChatGPT sign-in headers.

## Validation

```bash
npm test
npm run lint
npm run build
```

## Data And Deployment

- D1 binding: `DB`
- Schema: `db/schema.ts`
- Migrations: `drizzle/`
- Runtime secrets are configured in Sites, not committed to Git.

Nutrition and calorie targets are estimates and are not medical advice.
