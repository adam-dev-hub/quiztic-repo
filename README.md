# Quiz'TIC

Quiz'TIC is a mobile learning platform built with **Expo + React Native** that helps teachers create, manage, and run interactive quizzes while students participate live and track their progress.

![Quiz'TIC Splash Screen Logo](./quiztic_slogan.svg)

## Features

- Teacher and student authentication flows
- Live quiz sessions and quiz scheduling
- AI-assisted quiz content generation and question enhancement
- Curriculum generation support
- Student performance analytics and pedagogical metrics
- Multilingual UI support (`ar`, `en`, `fr`, `jp`)

## Tech Stack

- **Mobile app:** Expo, React Native, Expo Router
- **Backend services:** Vercel serverless functions (Node.js)
- **Data/Auth:** Appwrite
- **AI:** Google Gemini

## Project Structure

```text
.
├── app/                      # Expo Router screens (student/teacher flows)
├── components/               # Shared UI components
├── contexts/                 # App-wide contexts (language, user)
├── translations/             # i18n JSON dictionaries
└── backend/
    ├── AI-Content-Generation/
    ├── AI-Question-Enhancer/
    ├── Generate-Curriculum-Function/
    └── Metrics-Calculation-Function/
```

## Prerequisites

- Node.js (LTS recommended)
- npm
- Android Studio + SDK (for local Android builds)

## Run the Mobile App

```sh
npm install
npx expo run:android or npx expo run:ios
```


## Backend Functions (Vercel)

Each folder inside `backend/` is an independent serverless function project:

1. `AI-Content-Generation` - Generates quiz questions from uploaded course content.
2. `AI-Question-Enhancer` - Improves an existing question from user prompts.
3. `Generate-Curriculum-Function` - Builds curriculum plans from classroom context.
4. `Metrics-Calculation-Function` - Computes student/class engagement and performance metrics.

Install dependencies per function:

```sh
cd backend/<Function-Name>
npm install
```

## Environment Variables

The backend functions use environment variables such as:

- `APPWRITE_ENDPOINT`
- `APPWRITE_PROJECT_ID`
- `APPWRITE_API_KEY`
- `APPWRITE_DATABASE_ID`
- `GEMINI_API_KEY`

Some functions also require additional Appwrite collection/database IDs depending on your setup.

## Author

**Adam Farjeoui**

- Website: https://farjeoui-portfolio.vercel.app
- GitHub: https://github.com/adam-dev-hub
- LinkedIn: https://linkedin.com/in/adam-al-farjeoui
