'use client';

import { useEffect, useState } from 'react';
import {
  ArrowRight,
  Copy,
  LockKeyhole,
  RefreshCw,
  Users,
  Trash2,
} from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import AppShell from '@/components/AppShell';
import { getSupabase } from '@/lib/supabase';

type GameRow = {
  id: string;
  name: string;
  room_code: string;
  host_id: string;
  status: string;
  max_players: number;
  total_rounds: number;
  current_round: number;
  voting_seconds: number;
  votes_per_player: number;
};

type PlayerRow = {
  id: string;
  user_id: string;
};

export default function RoomPage() {
  const params = useParams<{ code: string }>();
  const router = useRouter();

  const [game, setGame] =
    useState<GameRow | null>(null);

  const [players, setPlayers] =
    useState<PlayerRow[]>([]);

  const [userId, setUserId] =
    useState('');

  const [error, setError] =
    useState('');

  const [busy, setBusy] =
    useState(false);

  const [copied, setCopied] =
    useState(false);

  const [deleting, setDeleting] =
    useState(false);

  const code = String(
    params.code || ''
  ).toUpperCase();

  async function load() {
    const supabase = getSupabase();

    if (!supabase) {
      setError(
        'Supabase is not configured.'
      );
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.replace('/auth');
      return;
    }

    setUserId(user.id);

    const {
      data: gameData,
      error: gameError,
    } = await supabase
      .from('games')
      .select(
        'id,name,room_code,host_id,status,max_players,total_rounds,current_round,voting_seconds,votes_per_player'
      )
      .eq('room_code', code)
      .maybeSingle();

    if (gameError || !gameData) {
      setError(
        'Room unavailable. Make sure you joined with the correct credentials.'
      );
      return;
    }

    setGame(gameData as GameRow);

    const {
      data: playerData,
      error: playerError,
    } = await supabase
      .from('game_players')
      .select('id,user_id')
      .eq('game_id', gameData.id);

    if (playerError) {
      setError(playerError.message);
      return;
    }

    setPlayers(
      (playerData || []) as PlayerRow[]
    );
  }

  useEffect(() => {
    load();
  }, [code]);

  async function start() {
    const supabase = getSupabase();

    if (!supabase || !game) {
      return;
    }

    setBusy(true);
    setError('');

    const {
      error: startError,
    } = await supabase.rpc(
      'start_game',
      {
        p_game_id: game.id,
      }
    );

    if (startError) {
      setError(startError.message);
    } else {
      setGame({
        ...game,
        status: 'voting',
        current_round: 1,
      });

      router.push('/vote');
    }

    setBusy(false);
  }

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(
        game?.room_code || code
      );

      setCopied(true);

      window.setTimeout(() => {
        setCopied(false);
      }, 1800);
    } catch {
      setError(
        'Unable to copy the room code.'
      );
    }
  }

  async function deleteRoom() {
    if (!game || deleting) {
      return;
    }

    const confirmed = window.confirm(
      'Delete this room permanently?\n\nAll players, rounds, rankings, votes, and the room password will be removed. This cannot be undone.'
    );

    if (!confirmed) {
      return;
    }

    const supabase = getSupabase();

    if (!supabase) {
      setError(
        'Supabase is not configured.'
      );
      return;
    }

    setDeleting(true);
    setError('');

    const {
      error: deleteError,
    } = await supabase.rpc(
      'delete_game',
      {
        p_game_id: game.id,
      }
    );

    if (deleteError) {
      setError(deleteError.message);
      setDeleting(false);
      return;
    }

    router.replace('/dashboard');
  }

  const isHost =
    Boolean(game) &&
    Boolean(userId) &&
    game?.host_id === userId;

  const canStart =
    game?.status === 'waiting' &&
    players.length >= 3 &&
    isHost;

  return (
    <AppShell>
      <div className="topbar">
        <div>
          <h1 className="page-title">
            Private Room
          </h1>

          <div className="sub">
            Your game, your players, your
            hierarchy.
          </div>
        </div>

        <div className="top-actions">
          <button
            className="btn light"
            onClick={load}
            disabled={busy || deleting}
          >
            <RefreshCw size={15} />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div
          className="error"
          style={{
            marginBottom: 16,
          }}
        >
          {error}
        </div>
      )}

      {!game ? (
        <div
          className="card"
          style={{ padding: 28 }}
        >
          <div className="empty">
            Loading room…
          </div>
        </div>
      ) : (
        <>
          <div className="grid2">
            <div
              className="card"
              style={{ padding: 28 }}
            >
              <div className="eyebrow">
                PRIVATE ROOM
              </div>

              <h2
                className="serif"
                style={{
                  fontSize: 34,
                  margin: '8px 0 4px',
                }}
              >
                {game.name}
              </h2>

              <div className="sub">
                Room code
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  marginTop: 8,
                  flexWrap: 'wrap',
                }}
              >
                <strong
                  style={{
                    fontSize: 26,
                    letterSpacing: 2,
                  }}
                >
                  {game.room_code}
                </strong>

                <button
                  className="btn light"
                  onClick={copyCode}
                >
                  <Copy size={14} />
                  {copied
                    ? 'Copied'
                    : 'Copy Code'}
                </button>
              </div>
            </div>

            <div
              className="card"
              style={{ padding: 28 }}
            >
              <div className="eyebrow">
                ACCESS
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  marginTop: 12,
                }}
              >
                <LockKeyhole
                  size={24}
                />

                <div>
                  <strong>
                    Password protected
                  </strong>

                  <div className="small">
                    Only authenticated players
                    with the room credentials
                    can join.
                  </div>
                </div>
              </div>

              <div
                style={{
                  marginTop: 18,
                }}
              >
                <div className="eyebrow">
                  ROOM STATUS
                </div>

                <div
                  className="round-badge"
                  style={{
                    display:
                      'inline-block',
                    marginTop: 8,
                  }}
                >
                  {game.status ===
                  'waiting'
                    ? 'Waiting to Start'
                    : game.status ===
                        'voting'
                      ? 'Voting'
                      : game.status ===
                          'results'
                        ? 'Results'
                        : 'Finished'}
                </div>
              </div>
            </div>
          </div>

          <div
            className="card"
            style={{
              marginTop: 16,
              padding: 28,
            }}
          >
            <div
              className="topbar"
              style={{
                marginBottom: 16,
              }}
            >
              <div>
                <div className="eyebrow">
                  PLAYERS
                </div>

                <h2
                  className="serif"
                  style={{
                    fontSize: 28,
                    margin: '6px 0',
                  }}
                >
                  {players.length} /{' '}
                  {game.max_players}
                </h2>
              </div>

              <Users size={22} />
            </div>

            {players.length === 0 ? (
              <div className="empty">
                No players yet.
              </div>
            ) : (
              <div
                style={{
                  display: 'grid',
                  gap: 8,
                }}
              >
                {players.map(
                  (player, index) => (
                    <div
                      key={player.id}
                      style={{
                        display: 'flex',
                        alignItems:
                          'center',
                        justifyContent:
                          'space-between',
                        padding:
                          '12px 4px',
                        borderBottom:
                          '1px solid #eee',
                      }}
                    >
                      <span>
                        Player {index + 1}
                      </span>

                      {player.user_id ===
                        userId && (
                        <span className="small">
                          You
                        </span>
                      )}

                      {player.user_id ===
                        game.host_id && (
                        <span className="small">
                          Host
                        </span>
                      )}
                    </div>
                  )
                )}
              </div>
            )}

            {game.status ===
              'waiting' && (
              <div
                style={{
                  marginTop: 22,
                  padding: 16,
                  border:
                    '1px solid #eee',
                  borderRadius: 14,
                }}
              >
                <div className="eyebrow">
                  GAME RULES
                </div>

                <div
                  className="small"
                  style={{
                    marginTop: 8,
                    lineHeight: 1.7,
                  }}
                >
                  {game.total_rounds}{' '}
                  rounds ·{' '}
                  {game.voting_seconds}{' '}
                  seconds voting time ·{' '}
                  {game.votes_per_player}{' '}
                  vote
                  {game.votes_per_player ===
                  1
                    ? ''
                    : 's'}{' '}
                  per player
                </div>
              </div>
            )}

            {game.status ===
              'waiting' && (
              <div
                style={{
                  marginTop: 22,
                  display: 'flex',
                  gap: 10,
                  flexWrap: 'wrap',
                }}
              >
                {isHost && (
                  <button
                    className="btn red"
                    onClick={start}
                    disabled={!canStart || busy}
                  >
                    {busy
                      ? 'Starting…'
                      : players.length < 3
                        ? `Need ${
                            3 -
                            players.length
                          } more player${
                            3 -
                              players.length ===
                            1
                              ? ''
                              : 's'
                          }`
                        : 'Start Game'}
                    <ArrowRight
                      size={15}
                    />
                  </button>
                )}

                {!isHost &&
                  players.length <
                    3 && (
                    <div className="small">
                      The game needs at least
                      3 players before the host
                      can start it.
                    </div>
                  )}
              </div>
            )}
          </div>

          {isHost && (
            <div
              className="card"
              style={{
                marginTop: 16,
                padding: 22,
                border:
                  '1px solid #ead6d6',
              }}
            >
              <div className="eyebrow">
                DANGER ZONE
              </div>

              <h2
                className="serif"
                style={{
                  fontSize: 24,
                  margin: '6px 0',
                }}
              >
                Delete this room
              </h2>

              <p className="sub">
                Permanently removes this room and
                its players, rounds, rankings,
                votes, and password.
              </p>

              <button
                className="btn"
                onClick={deleteRoom}
                disabled={deleting}
                style={{
                  marginTop: 8,
                  borderColor: '#b33',
                  color: '#9b2f2f',
                }}
              >
                <Trash2 size={15} />

                {deleting
                  ? 'Deleting…'
                  : 'Delete Room'}
              </button>
            </div>
          )}
        </>
      )}
    </AppShell>
  );
}
