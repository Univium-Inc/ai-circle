# AI Debate Game

A Next.js 14 app where **six AI debaters with distinct personalities** argue a topic, then vote to eliminate one contestant each round.

## Phases
1. **Discussion** (2 min) – All active debaters speak every 10 s.
2. **Voting** – Each AI outputs `VOTE: Name` and a short reason.
3. **Results** – Tallies votes and eliminates the top‑voted player.
4. Loops until two finalists remain.

## Quick start

```bash
git clone <repo>
cd ai-debate-game
cp .env.local.example .env.local  # add your OpenAI key
npm install
npm run dev
```

Deploy on Vercel → add the env var `OPENAI_API_KEY`.
