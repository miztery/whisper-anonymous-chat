# Whisper — Anonymous Chat

A responsive anonymous social chat starter built with React, Vite, Firebase Authentication, and Cloud Firestore.

## Included in this starter

- Email/password registration and login
- Google account sign-in
- Anonymous public usernames (email and Google display name are not shown)
- Public rooms: General, Random, and Interests
- Create additional public rooms
- One-to-one private conversations
- Live message updates using Firestore listeners
- Dark and light themes
- Responsive desktop and mobile layout
- Firestore security rules
- Vercel deployment configuration

## Important privacy note

This is **pseudonymous**, not fully untraceable. Firebase Authentication retains account identity information, and administrators with appropriate project access can access backend data. Public chat messages are visible to signed-in members of the room. Private messages are restricted by Firestore rules to the two chat members. Do not promise end-to-end encryption: this starter does not implement it.

The first version intentionally supports text messages only. Image uploads, push notifications, presence, message deletion, moderation queues, and account recovery UX can be added in later phases.

## 1. Create a Firebase project

1. Open https://console.firebase.google.com/ and create a project.
2. Add a **Web App** in Project settings → General.
3. Copy the web app configuration values.
4. In Authentication → Sign-in method, enable:
   - Email/Password
   - Google
5. In Firestore Database, create a database.
6. Open Firestore → Rules, replace the rules with the contents of `firestore.rules`, and publish.

For Google sign-in, also confirm the authorized domains in Authentication → Settings → Authorized domains. Add your deployed Vercel domain after deployment.

## 2. Configure the website

1. Copy `.env.example` to `.env.local`.
2. Replace each `replace_me` value with the corresponding Firebase Web App config value.
3. Do not commit `.env.local` to GitHub. It is ignored by `.gitignore`.

Example:

```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project
VITE_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abcdef
```

Firebase web configuration values are identifiers, not server secrets. Security must come from Authentication, Firestore Rules, and appropriate project controls—not from hiding the web config.

## 3. Run locally (optional)

Install Node.js LTS, then run:

```bash
npm install
npm run dev
```

Open the local URL printed by Vite.

## 4. Upload to GitHub and deploy with Vercel

1. Create a new GitHub repository, for example `whisper-anonymous-chat`.
2. Upload all files and folders from this project. Do not upload `node_modules`, `dist`, or `.env.local`.
3. In Vercel, choose **Add New → Project**, import the GitHub repository.
4. Framework preset: Vite. Build command: `npm run build`. Output directory: `dist`.
5. In Vercel → Project → Settings → Environment Variables, add all six `VITE_FIREBASE_*` values from `.env.local`.
6. Redeploy after adding the environment variables.
7. Add the Vercel domain to Firebase Authentication → Settings → Authorized domains.

## 5. Data structure

- `profiles/{uid}` — public anonymous profile (no email field)
- `usernames/{username}` — username uniqueness reservation
- `rooms/{roomId}` — public room metadata
- `rooms/{roomId}/messages/{messageId}` — public room messages
- `chats/{chatId}` — private chat membership
- `chats/{chatId}/messages/{messageId}` — private messages

## 6. Before inviting real users

This is a starter/MVP, not a fully moderated production service. Before opening it to the public:

- Add rate limits and abuse/spam controls (preferably using trusted server-side logic or Cloud Functions/App Check).
- Add report/block workflows and a moderation/admin console.
- Define retention and deletion policies.
- Consider age-appropriate access and publish Terms of Service and a Privacy Notice.
- Review Firebase billing limits and usage alerts.
- Test Firestore Rules with the Firebase Emulator Suite.
- Consider end-to-end encryption if the product promises that even service operators cannot read private messages.

## Troubleshooting

- **Firebase not configured:** check `.env.local` spelling and restart Vite or redeploy Vercel.
- **Google popup error:** allow popups and check Firebase authorized domains.
- **Permission denied:** confirm `firestore.rules` were published to the correct Firebase project.
- **No users appear:** another user must have completed registration and chosen a username.
- **Room is empty:** messages only appear after someone sends a message in that room.
