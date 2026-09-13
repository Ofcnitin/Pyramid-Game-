'use client';

import { useEffect, useState } from 'react';
import {
  ArrowRight,
  Users,
  Clock,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import AppShell from '@/components/AppShell';
import { getSupabase } from '@/lib/supabase';

type Game = {
  id: string;
  name: string;
  room_code: string;
  status: 'waiting' | 'voting' | 'results' | 'finished';
  max_players: number;
  current_round: number;
};

type Player = {
  id: string;
  user_id: string;
  current_rank: number | null;
  previous_rank: number | null;
  points: number;
};

type Round = {
  ends_at: string;
};

export default function Dashboard() {
  const router = useRouter();

  const [name, setName] = useState('Player');
  const [game, setGame] = useState<Game | null>(null);
  const [player, setPlayer] = useState<Player | null>(null);
  const [playerCount, setPlayerCount] = useState(0);
  const [round, setRound] = useState<Round | null>(null);
  const [timeLeft, setTimeLeft] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadDashboard() {
      const supabase = getSupabase();

      if (!supabase) {
        setError('Supabase is not configured.');
        setLoading(false);
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace('/auth');
        return;
      }

      // Real profile name
      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('id', user.id)
        .maybeSingle();

      if (profile?.display_name) {
        setName(profile.display_name);
      }

      // Find the user's most recently joined game.
      const { data: membership, error: membershipError } = await supabase
        .from('game_players')
        .select('id,game_id,user_id,current_rank,previous_rank,points,joined_at')
        .eq('user_id', user.id)
        .order('joined_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (membershipError || !membership) {
        setLoading(false);
        return;
      }

      const { data: gameData, error: gameError } = await supabase
        .from('games')
        .select(
          'id,name,room_code,status,max_players,current_round'
        )
        .eq('id', membership.game_id)
        .maybeSingle();

      if (gameError || !gameData) {
        setError('Unable to load your game.');
        setLoading(false);
        return;
      }

      setGame(gameData as Game);
      setPlayer(membership as Player);

      // Real player count
      const { count } = await supabase
        .from('game_players')
        .select('id', { count: 'exact', head: true })
        .eq('game_id', gameData.id);

      setPlayerCount(count ?? 0);

      // Real current round
      if (gameData.current_round > 0) {
        const { data: roundData } = await supabase
          .from('rounds')
          .select('ends_at')
          .eq('game_id', gameData.id)
          .eq('round_number', gameData.current_round)
          .maybeSingle();

        setRound(roundData as Round | null);
      }

      setLoading(false);
    }

    loadDashboard();
  }, [router]);

  // Live countdown from the actual round deadline
  useEffect(() => {
    if (!round?.ends_at || game?.status !== 'voting') {
      setTimeLeft('');
      return;
    }

    function updateTimer() {
      const remaining = Math.max(
        0,
        new Date(round.ends_at).getTime() - Date.now()
      );

      const totalSeconds = Math.floor(remaining / 1000);
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;

      setTimeLeft(
        `${String(hours).padStart(2, '0')} : ${String(minutes).padStart(
          2,
          '0'
        )} : ${String(seconds).padStart(2, '0')}`
      );
    }

    updateTimer();

    const interval = window.setInterval(updateTimer, 1000);

    return () => window.clearInterval(interval);
  }, [round, game?.status]);

  const rankChange =
    player?.current_rank != null && player.previous_rank != null
      ? player.previous_rank - player.current_rank
      : 0;

  const statusLabel =
    game?.status === 'voting'
      ? 'Voting Phase'
      : game?.status === 'results'
        ? 'Results Phase'
        : game?.status === 'finished'
          ? 'Game Finished'
          : 'Waiting to Start';

  if (loading) {
    return (
      <AppShell>
        <div className="empty">Loading your game…</div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="topbar">
        <div>
          <h1 className="page-title">Welcome back, {name}.</h1>
          <div className="sub">
            {game
              ? 'Perception shapes your position.'
              : 'Join or create a private game to begin.'}
          </div>
        </div>

        {game && (
          <div className="top-actions">
            <span className="round-badge">
              Round {game.current_round || '—'}
            </span>
          </div>
        )}
      </div>

      {error && (
        <div className="error" style={{ marginBottom: 16 }}>
          {error}
        </div>
      )}

      {!game || !player ? (
        <div className="card" style={{ padding: 28 }}>
          <div className="eyebrow">NO ACTIVE GAME</div>
          <h2 className="serif" style={{ fontSize: 32 }}>
            Your pyramid is waiting.
          </h2>
          <p className="sub">
            Create a private game or join an existing room to see your real
            ranking and game statistics here.
          </p>

          <div className="actions">
            <button
              className="btn red"
              onClick={() => router.push('/create')}
            >
              Create Game <ArrowRight size={15} />
            </button>

            <button
              className="btn light"
              onClick={() => router.push('/join')}
            >
              Join Game <ArrowRight size={15} />
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="grid2">
            <div className="card countdown">
              <div className="eyebrow">
                {game.status === 'voting' ? 'VOTE ENDS IN' : 'CURRENT STATUS'}
              </div>

              {game.status === 'voting' && timeLeft ? (
                <>
                  <div className="timer">{timeLeft}</div>
                  <div className="timer-label">
                    Hours Minutes Seconds
                  </div>

                  <button
                    className="btn red"
                    style={{ marginTop: 20 }}
                    onClick={() => router.push('/vote')}
                  >
                    Enter Vote <ArrowRight size={15} />
                  </button>
                </>
              ) : (
                <>
                  <div className="timer" style={{ fontSize: 32 }}>
                    {statusLabel}
                  </div>

                  <div className="timer-label">
                    Round {game.current_round || '—'}
                  </div>
                </>
              )}
            </div>

            <div className="card quote">
              <p>
                “People show you who they are, you just rank them.”
              </p>
              <div className="eyebrow">— PYRAMID</div>
            </div>
          </div>

          <div className="grid3" style={{ marginTop: 16 }}>
            <div className="card stat">
              <div className="eyebrow">YOUR RANK</div>

              <div className="value">
                {player.current_rank != null
                  ? `#${player.current_rank}`
                  : 'Unranked'}
              </div>

              {rankChange !== 0 ? (
                <div
                  className={
                    rankChange > 0 ? 'delta' : 'rank-down'
                  }
                >
                  {rankChange > 0 ? (
                    <TrendingUp
                      size={13}
                      style={{ verticalAlign: '-2px' }}
                    />
                  ) : (
                    <TrendingDown
                      size={13}
                      style={{ verticalAlign: '-2px' }}
                    />
                  )}{' '}
                  {rankChange > 0 ? '+' : ''}
                  {rankChange} this round
                </div>
              ) : (
                <div className="muted">No rank change yet</div>
              )}
            </div>

            <div className="card stat">
              <div className="eyebrow">TOTAL PLAYERS</div>

              <div className="value">
                {playerCount.toLocaleString()}
              </div>

              <div className="muted">
                <Users
                  size={14}
                  style={{ verticalAlign: '-2px' }}
                />{' '}
                In your game
              </div>
            </div>

            <div className="card stat">
              <div className="eyebrow">CURRENT STAGE</div>

              <div className="value">
                Round {game.current_round || '—'}
              </div>

              <div className="delta">
                <Clock
                  size={13}
                  style={{ verticalAlign: '-2px' }}
                />{' '}
                {statusLabel}
              </div>
            </div>
          </div>

          <div className="card" style={{ marginTop: 16, padding: 22 }}>
            <div
              className="topbar"
              style={{ marginBottom: 8 }}
            >
              <div>
                <h2 className="serif" style={{ fontSize: 23 }}>
                  Your game
                </h2>

                <div className="small">
                  {game.name} · Private room · {game.room_code}
                </div>
              </div>

              <div className="actions">
                <button
                  className="btn"
                  onClick={() =>
                    router.push(`/room/${game.room_code}`)
                  }
                >
                  Open Room <ArrowRight size={14} />
                </button>

                <button
                  className="btn light"
                  onClick={() => router.push('/leaderboard')}
                >
                  View Rankings <ArrowRight size={14} />
                </button>
              </div>
            </div>

            <p className="sub">
              Your statistics above are loaded from the current private
              game rather than demo data.
            </p>
          </div>
        </>
      )}
    </AppShell>
  );
}
