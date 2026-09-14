'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, Send, RefreshCw } from 'lucide-react';
import AppShell from '@/components/AppShell';
import { getSupabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

type Game = {
  id: string;
  votes_per_player: number;
  allow_self_vote: boolean;
};

type Round = {
  id: string;
  game_id: string;
  round_number: number;
  status: string;
  ends_at: string;
};

type Player = {
  id: string;
  user_id: string;
};

export default function VotePage() {
  const router = useRouter();

  const [game, setGame] = useState<Game | null>(null);
  const [round, setRound] = useState<Round | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [me, setMe] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [left, setLeft] = useState('—');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    const s = getSupabase();

    if (!s) {
      setError('Supabase is not configured.');
      return;
    }

    const {
      data: { user },
    } = await s.auth.getUser();

    if (!user) {
      router.replace('/auth');
      return;
    }

    setMe(user.id);

    const {
      data: mine,
      error: meErr,
    } = await s
      .from('game_players')
      .select('game_id')
      .eq('user_id', user.id)
      .order('joined_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (meErr || !mine) {
      setError('Join a game before voting.');
      return;
    }

    const {
      data: g,
      error: ge,
    } = await s
      .from('games')
      .select('id,votes_per_player,allow_self_vote')
      .eq('id', mine.game_id)
      .single();

    if (ge || !g) {
      setError('Game unavailable.');
      return;
    }

    setGame(g);

    const {
      data: r,
      error: re,
    } = await s
      .from('rounds')
      .select('id,game_id,round_number,status,ends_at')
      .eq('game_id', g.id)
      .order('round_number', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (re || !r) {
      setError('No active round.');
      return;
    }

    setRound(r);

    const {
      data: p,
      error: pe,
    } = await s
      .from('game_players')
      .select('id,user_id')
      .eq('game_id', g.id);

    if (pe) {
      setError(pe.message);
      return;
    }

    setPlayers(p || []);
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!round) return;

    const tick = () => {
      const d = Math.max(
        0,
        Math.floor(
          (new Date(round.ends_at).getTime() - Date.now()) / 1000
        )
      );

      setLeft(
        `${String(Math.floor(d / 3600)).padStart(2, '0')} : ` +
        `${String(Math.floor(d / 60) % 60).padStart(2, '0')} : ` +
        `${String(d % 60).padStart(2, '0')}`
      );

      if (d === 0) {
        load();
      }
    };

    tick();

    const id = setInterval(tick, 1000);

    return () => clearInterval(id);
  }, [round]);

  const candidates = useMemo(
    () =>
      players.filter(
        (p) => game?.allow_self_vote || p.user_id !== me
      ),
    [players, game, me]
  );

  function toggle(id: string) {
    setSelected((current) => {
      if (current.includes(id)) {
        return current.filter((x) => x !== id);
      }

      if (
        game &&
        current.length < game.votes_per_player
      ) {
        return [...current, id];
      }

      return current;
    });
  }

  async function submit() {
    if (!round || !game) return;

    if (selected.length < 1) {
      setError('Choose at least 1 player.');
      return;
    }

    if (selected.length > game.votes_per_player) {
      setError(
        `You can select at most ${game.votes_per_player} players.`
      );
      return;
    }

    setBusy(true);
    setError('');

    const s = getSupabase();

    if (!s) {
      setError('Supabase is not configured.');
      setBusy(false);
      return;
    }

    const { error } = await s.rpc('submit_votes', {
      p_round_id: round.id,
      p_target_ids: selected,
    });

    if (error) {
      setError(error.message);
    } else {
      setSubmitted(true);
    }

    setBusy(false);
  }

  return (
    <AppShell>
      <div className="topbar">
        <div>
          <h1 className="page-title">
            Round {round?.round_number ?? '—'} Voting
          </h1>

          <div className="sub">
            Choose the players you think are least trustworthy.
          </div>
        </div>

        <div className="round-badge">
          Time left {left}
        </div>
      </div>

      {error && (
        <div
          className="error"
          style={{ marginBottom: 16 }}
        >
          {error}
        </div>
      )}

      {submitted ? (
        <div className="card empty">
          <h2 className="serif">
            Vote submitted.
          </h2>

          <p>
            Your choices are locked and anonymous.
          </p>

          <button
            className="btn light"
            onClick={() => router.push('/pyramid')}
          >
            View Pyramid
          </button>
        </div>
      ) : (
        <>
          <div className="vote-grid">
            {candidates.map((p, i) => (
              <button
                key={p.id}
                className={
                  'player-card ' +
                  (selected.includes(p.id) ? 'selected' : '')
                }
                onClick={() => toggle(p.id)}
              >
                <div className="avatar">
                  {i + 1}
                </div>

                <div
                  style={{
                    fontWeight: 600,
                    marginTop: 8,
                  }}
                >
                  Player {i + 1}
                </div>

                <div className="small">
                  #{p.id.slice(0, 6)}
                </div>

                <div className="check">
                  {selected.includes(p.id) ? (
                    <Check
                      size={16}
                      style={{ margin: 'auto' }}
                    />
                  ) : (
                    <span>&nbsp;</span>
                  )}
                </div>
              </button>
            ))}
          </div>

          <div
            style={{
              textAlign: 'center',
              marginTop: 28,
            }}
          >
            <button
              className="btn red"
              disabled={
                busy ||
                !game ||
                selected.length < 1 ||
                selected.length > game.votes_per_player ||
                round?.status !== 'voting'
              }
              onClick={submit}
            >
              <Send size={14} />

              {busy
                ? 'Submitting…'
                : 'Submit Vote'}
            </button>

            <div className="notice">
              {selected.length} / {game?.votes_per_player ?? '—'} selected
              {selected.length === 0
                ? ' · Choose at least 1'
                : ' · Your vote is anonymous.'}
            </div>

            <button
              className="icon-btn"
              style={{ marginTop: 12 }}
              onClick={load}
              aria-label="Refresh"
            >
              <RefreshCw size={15} />
            </button>
          </div>
        </>
      )}
    </AppShell>
  );
        }
