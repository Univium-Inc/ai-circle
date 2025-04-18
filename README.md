# Cult Sim Chat V2

## Setup

1. **Supabase**  
   - Create a new project.  
   - Go to SQL Editor, run `supabase.sql`.  
   - From Settings → API, copy `SUPABASE_URL` and `SUPABASE_ANON_KEY`.

2. **Vercel**  
   - Push this project to your GitHub.  
   - In Vercel, import the repo.

3. **Environment Variables**  
   - `NEXT_PUBLIC_SUPABASE_URL`  
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`  
   - `OPENAI_API_KEY`

4. **Run**  
   ```bash
   npm install
   npm run dev
   ```
   Your app will be live on Vercel!

This version uses OpenAI to generate AI responses, private chat per AI, professional UI with Tailwind, and countdown timers for message & attack tokens.