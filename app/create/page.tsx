'use client';

import { FormEvent, useState } from 'react';
import {
  ArrowRight,
  LockKeyhole,
  Copy,
  Check
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import AppShell from '@/components/AppShell';
import { getSupabase } from '@/lib/supabase';

export default function CreateGame() {
  const router = useRouter();

  const [name, setName] = useState('Friday Night Pyramid');
  const [max, setMax] = useState(16);
  const [rounds, setRounds] = useState(6);
  const [duration, setDuration] = useState(300);
  const [votes, setVotes] = useState(3);
  const [password, setPassword] = useState('');
  const [result, setResult] = useState('');
  const [created, setCreated] = useState(false);
  const [copied, setCopied] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setResult('');

    const supabase = getSupabase();

    if (!supabase) {
      setResult(
        'Supabase is not configured. Add the environment variables from .env.example.'
      );
      return;
    }

    const { data, error } = await supabase.rpc('create_game', {
      p_name: name,
      p_password: password,
      p_max_players: max,
      p_total_rounds: rounds,
      p_voting_seconds: duration,
      p_votes_per_player: votes
    });

    if (error) {
      setResult(error.message);
      return;
    }

    setCreated(true);
    setResult(data?.room_code || '');
  }

  return (
    <AppShell>
      <div className="topbar">
        <div>
          <h1 className="page-title">Create Game</h1>

          <div className="sub">
            Build a private room. Authentication and a room password are
            always required.
          </div>
        </div>
      </div>

      {created ? (
        <div
          className="card"
          style={{
            maxWidth: 650,
            padding: 28
          }}
        >
          <div className="eyebrow">ROOM CREATED</div>

          <h2
            className="serif"
            style={{
              fontSize: 38
            }}
          >
            {result}
          </h2>

          <p className="sub">
            Share the room code and password only with the players you trust.
          </p>

          <div className="actions">
            <button
              className="btn light"
              onClick={async () => {
                await navigator.clipboard?.writeText(`${result}`);
                setCopied(true);
              }}
            >
              {copied ? <Check size={15} /> : <Copy size={15} />}

              {copied ? 'Copied' : 'Copy code'}
            </button>

            <button
              className="btn red"
              onClick={() => router.push('/dashboard')}
            >
              Go to Dashboard
              <ArrowRight size={15} />
            </button>
          </div>
        </div>
      ) : (
        <form
          className="card"
          style={{
            maxWidth: 720,
            padding: 24
          }}
          onSubmit={submit}
        >
          <div className="field">
            <label>Game name</label>

            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
              required
            />
          </div>

          <div className="settings-grid">
            <div className="field">
              <label>Maximum players</label>

              <input
                type="number"
                min={3}
                max={64}
                value={max}
                onChange={(e) => setMax(+e.target.value)}
                required
              />
            </div>

            <div className="field">
              <label>Total rounds</label>

              <input
                type="number"
                min={1}
                max={30}
                value={rounds}
                onChange={(e) => setRounds(+e.target.value)}
                required
              />
            </div>

            <div className="field">
              <label>Voting duration (seconds)</label>

              <input
                type="number"
                min={30}
                max={3600}
                value={duration}
                onChange={(e) => setDuration(+e.target.value)}
                required
              />
            </div>

            <div className="field">
              <label>Votes per player</label>

              <input
                type="number"
                min={1}
                max={10}
                value={votes}
                onChange={(e) => setVotes(+e.target.value)}
                required
              />
            </div>
          </div>

          <div className="field">
            <label>
              <LockKeyhole
                size={13}
                style={{
                  verticalAlign: '-2px'
                }}
              />{' '}
              Room password
            </label>

            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              placeholder="At least 8 characters"
              required
            />
          </div>

          {result && (
            <div className="error">
              {result}
            </div>
          )}

          <button
            className="btn red"
            type="submit"
          >
            Create Private Game
            <ArrowRight size={15} />
          </button>
        </form>
      )}
    </AppShell>
  );
}
