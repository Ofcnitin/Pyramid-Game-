# Pyramid Game

> **RANKS REVEAL PEOPLE.**

A multiplayer social-ranking game inspired by the concept of the K-drama *Pyramid Game*.

I originally started this as a fun experiment after watching the series and becoming interested in the idea behind its voting and ranking system. What looked simple from the outside turned out to involve authentication, secure rooms, anonymous voting, game-state management, ranking algorithms, database security, and a lot more.

So I decided to build my own practical version.

## 🎮 Live Demo

**https://pyramid-game.ofcnitin.workers.dev**

---

## About

Pyramid Game is a private multiplayer game where players join a room, vote anonymously, and watch the social hierarchy form from the collective voting results.

The goal wasn't to simply recreate a UI from the series.

The goal was to take the core idea and turn it into a **real, playable web application** with proper authentication, database-backed game state, secure voting, and server-authoritative results.

### Core flow

```text
Create / Join Room
        ↓
   Wait for Players
        ↓
     Start Game
        ↓
   Timed Voting
        ↓
 Anonymous Votes
        ↓
 Server-side Results
        ↓
  Dynamic Grading
        ↓
   Pyramid / Ranking
        ↓
    Next Round


---

✨ Features

🔐 Private Multiplayer Rooms

Every player needs an authenticated account.

Rooms require both a room code and password.

Room passwords are securely hashed.

Players can only access rooms they have joined.


🗳️ Anonymous Voting

Players vote for other players during a timed round.

Players cannot see who voted for them.

Raw vote records are not exposed to the client.

Duplicate submissions are prevented.

Self-voting can be disabled.


⏱️ Timed Rounds

Each round has a server-controlled voting deadline.

Voting automatically becomes invalid after the deadline.

Clients cannot extend the voting timer.


📊 Dynamic Rankings

The hierarchy is generated from the actual voting distribution of the group.

Instead of using fixed rules such as:

80+ votes = A
60+ votes = B
40+ votes = C

the system evaluates the group's voting pattern and determines the relative position of each player.

Grades range from:

A → B → C → D → E → F

with multiple players able to share the same grade.

🏆 Leaderboard

Players can see their current position, points, rank changes, and game progress without being given access to private vote information.

👤 Player Profiles

Profiles track information such as:

Points

Current rank

Current game

Round history

Recorded results


📱 Responsive UI

The interface is designed to work across:

Desktop

Tablet

Mobile


The mobile experience uses a dedicated responsive layout rather than simply shrinking the desktop interface.


---

🛡️ Security

Security was one of the most important parts of the project.

The browser is not trusted with authoritative game operations.

Authentication

Gameplay routes require an authenticated Supabase session.

Room Security

A room cannot be joined using the room code alone.

The player must provide:

Authenticated account
        +
Room code
        +
Room password

Passwords are stored as bcrypt hashes and are never returned to the client.

Anonymous Votes

The votes table intentionally has no client read policy.

Players can submit votes through a validated server-side function, but they cannot query the underlying vote records to discover who voted for whom.

Server-authoritative game logic

Important operations are handled through PostgreSQL functions rather than trusting client-side state:

Creating games

Joining games

Submitting votes

Starting games

Starting rounds

Closing rounds

Generating rankings


The database validates things such as:

Authentication

Room membership

Room capacity

Vote count

Duplicate votes

Target membership

Self-voting rules

Voting deadlines

Host permissions


Row Level Security

Supabase Row Level Security is enabled on the game's core tables.

The intention is simple:

> The client can request actions, but the database decides whether those actions are allowed.




---

🧠 What I Learned

This project started as something I wanted to build because I found the concept interesting.

It ended up becoming a practical way to apply things I had previously only studied theoretically.

While building it, I worked with concepts such as:

Authentication

PostgreSQL

Database relationships

Row Level Security

Server-side validation

Secure RPCs

Password hashing

Anonymous data handling

Voting algorithms

Ranking systems

Game-state management

Timed rounds

Responsive UI

Cloud deployment


One of the biggest lessons was that a feature that looks simple from the outside can become surprisingly complex when you actually have to make it secure, consistent and reliable.


---

🏗️ Tech Stack

Frontend

Next.js

React

TypeScript

Tailwind CSS

Lucide React


Backend

Supabase

PostgreSQL

Supabase Auth

PostgreSQL RPC functions

Row Level Security


Deployment

Cloudflare Workers


Development

Git

GitHub

TypeScript



---

📁 Project Structure

pyramid-game/
│
├── app/
│   ├── auth/
│   ├── create/
│   ├── dashboard/
│   ├── join/
│   ├── leaderboard/
│   ├── messages/
│   ├── profile/
│   ├── pyramid/
│   ├── room/
│   ├── settings/
│   └── vote/
│
├── components/
│   ├── AppShell.tsx
│   ├── Dashboard.tsx
│   ├── Logo.tsx
│   └── Pyramid.tsx
│
├── lib/
│   ├── mock.ts
│   ├── supabase.ts
│   └── types.ts
│
├── public/
│   ├── logo.svg
│   └── brand-pyramid.svg
│
├── supabase/
│   └── schema.sql
│
├── middleware.ts
├── next.config.ts
├── package.json
└── README.md


---

🚀 Running Locally

1. Clone the repository

git clone https://github.com/Ofcnitin/Pyramid-Game-.git
cd Pyramid-Game-

2. Install dependencies

npm install

3. Create environment variables

Create .env.local:

NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_publishable_key

Never commit .env.local or a Supabase service-role/secret key.

4. Configure Supabase

Create a Supabase project and run:

supabase/schema.sql

inside the Supabase SQL Editor.

This creates the database structure, security policies, and server-side game functions.

5. Start the development server

npm run dev

Then open:

http://localhost:3000


---

☁️ Deployment

The production version is deployed using:

GitHub
   ↓
Cloudflare Workers
   ↓
Next.js Application
   ↓
Supabase
 ┌───────────────┐
 │ Authentication│
 │ PostgreSQL    │
 │ RLS           │
 │ Game RPCs     │
 └───────────────┘

Production:

https://pyramid-game.ofcnitin.workers.dev


---

⚠️ Project Status

This is a personal project and an ongoing experiment.

The main gameplay architecture is functional, but there are still areas that can be improved, including:

More extensive multiplayer testing

Automatic round closing

Realtime game-state updates

More robust rate limiting

Additional moderation features

Further mobile UI refinement

More advanced game statistics


The project is intentionally being developed incrementally rather than treating the first working version as the final version.


---

🎯 Why I Built It

I didn't build Pyramid Game because I thought I had found the next big social platform.

I built it because I watched something interesting and thought:

> "Could I actually build this?"



That question turned a simple idea into a project where theoretical concepts became actual working systems.

And that's probably the most valuable part of the project.


---

📜 Inspiration

The project was inspired by the fictional game concept presented in the K-drama Pyramid Game.

This is an independent fan-inspired implementation and is not affiliated with, endorsed by, or connected to the creators, production company, or rights holders of the series.

The implementation, branding, UI, database architecture, and gameplay system in this repository were developed independently.


---

📄 License

This project is provided for personal, educational, and experimental use.

See the repository for the current licensing and project terms.


---
