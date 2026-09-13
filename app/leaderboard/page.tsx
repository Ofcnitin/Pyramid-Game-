'use client';

import { useEffect, useState } from 'react';
import AppShell from '@/components/AppShell';
import { getSupabase } from '@/lib/supabase';

type Game = {
  id: string;
  name: string;
  room_code: string;
  status: 'waiting' | 'voting' | 'results' | 'finished';
  current_round: number;
};

type Player = {
  id: string;
  user_id: string;
  current_rank: number | null;
  previous_rank: number | null;
  points: number;
};

type Profile = {
  id: string;
  display_name: string;
  avatar_url: string | null;
};

type LeaderboardPlayer = {
  id: string;
  user_id: string;
  name: string;
  avatar_url: string | null;
  rank: number | null;
  previousRank: number | null;
  points: number;
};

export default function LeaderboardPage() {
  const [game, setGame] = useState<Game | null>(null);
  const [players, setPlayers] = useState<
    LeaderboardPlayer[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadLeaderboard() {
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
        window.location.href = '/auth';
        return;
      }

      /*
       * Find the authenticated user's most recently
       * joined game.
       */
      const {
        data: membership,
        error: membershipError,
      } = await supabase
        .from('game_players')
        .select('game_id')
        .eq('user_id', user.id)
        .order('joined_at', {
          ascending: false,
        })
        .limit(1)
        .maybeSingle();

      if (membershipError) {
        setError(
          'Unable to load your game membership.'
        );
        setLoading(false);
        return;
      }

      if (!membership) {
        setLoading(false);
        return;
      }

      /*
       * Load the private game.
       * RLS ensures the user can only access
       * games they belong to.
       */
      const {
        data: gameData,
        error: gameError,
      } = await supabase
        .from('games')
        .select(
          'id,name,room_code,status,current_round'
        )
        .eq('id', membership.game_id)
        .maybeSingle();

      if (gameError || !gameData) {
        setError('Unable to load your game.');
        setLoading(false);
        return;
      }

      setGame(gameData as Game);

      /*
       * Load only players belonging to this private game.
       */
      const {
        data: playerData,
        error: playerError,
      } = await supabase
        .from('game_players')
        .select(
          'id,user_id,current_rank,previous_rank,points'
        )
        .eq('game_id', gameData.id);

      if (playerError) {
        setError(
          'Unable to load the game rankings.'
        );
        setLoading(false);
        return;
      }

      const gamePlayers =
        (playerData || []) as Player[];

      if (gamePlayers.length === 0) {
        setPlayers([]);
        setLoading(false);
        return;
      }

      /*
       * Fetch display names separately instead of exposing
       * any sensitive authentication information.
       */
      const userIds = gamePlayers.map(
        (player) => player.user_id
      );

      const {
        data: profileData,
        error: profileError,
      } = await supabase
        .from('profiles')
        .select(
          'id,display_name,avatar_url'
        )
        .in('id', userIds);

      if (profileError) {
        setError(
          'Unable to load player profiles.'
        );
        setLoading(false);
        return;
      }

      const profiles =
        (profileData || []) as Profile[];

      const profileMap = new Map(
        profiles.map((profile) => [
          profile.id,
          profile,
        ])
      );

      /*
       * Build the leaderboard from real game_players data.
       */
      const leaderboard: LeaderboardPlayer[] =
        gamePlayers.map((player) => {
          const profile = profileMap.get(
            player.user_id
          );

          return {
            id: player.id,
            user_id: player.user_id,
            name:
              profile?.display_name ||
              'Player',
            avatar_url:
              profile?.avatar_url || null,
            rank: player.current_rank,
            previousRank:
              player.previous_rank,
            points: player.points,
          };
        });

      /*
       * Ranked players first.
       * Lower numeric rank = higher position.
       * Unranked players go to the bottom.
       */
      leaderboard.sort((a, b) => {
        if (
          a.rank === null &&
          b.rank === null
        ) {
          return a.name.localeCompare(
            b.name
          );
        }

        if (a.rank === null) {
          return 1;
        }

        if (b.rank === null) {
          return -1;
        }

        return a.rank - b.rank;
      });

      setPlayers(leaderboard);
      setLoading(false);
    }

    loadLeaderboard();
  }, []);

  if (loading) {
    return (
      <AppShell>
        <div className="empty">
          Loading rankings…
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="topbar">
        <div>
          <h1 className="page-title">
            Leaderboard
          </h1>

          <div className="sub">
            See where perception has placed
            everyone in your game.
          </div>
        </div>

        {game && (
          <div className="top-actions">
            <span className="round-badge">
              Round{' '}
              {game.current_round || '—'}
            </span>
          </div>
        )}
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
          <div className="eyebrow">
            NO ACTIVE GAME
          </div>

          <h2
            className="serif"
            style={{ fontSize: 32 }}
          >
            No rankings yet.
          </h2>

          <p className="sub">
            Join or create a private game to
            see its leaderboard.
          </p>
        </div>
      ) : (
        <>
          <div
            className="card"
            style={{
              padding: 22,
              marginBottom: 16,
            }}
          >
            <div className="eyebrow">
              CURRENT GAME
            </div>

            <h2
              className="serif"
              style={{
                fontSize: 28,
                margin: '6px 0',
              }}
            >
              {game.name}
            </h2>

            <div className="small">
              Private room · {game.room_code}
            </div>
          </div>

          <div
            className="card"
            style={{
              padding: '10px 20px',
            }}
          >
            {players.length === 0 ? (
              <div className="empty">
                No players found.
              </div>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Player</th>
                    <th>Points</th>
                    <th>Change</th>
                  </tr>
                </thead>

                <tbody>
                  {players.map((player) => {
                    const change =
                      player.rank !== null &&
                      player.previousRank !==
                        null
                        ? player.previousRank -
                          player.rank
                        : 0;

                    return (
                      <tr
                        key={player.id}
                      >
                        <td>
                          {player.rank ??
                            '—'}
                        </td>

                        <td>
                          <span
                            style={{
                              display:
                                'inline-flex',
                              alignItems:
                                'center',
                              gap: 9,
                            }}
                          >
                            <span
                              className="avatar"
                              style={{
                                width: 28,
                                height: 28,
                                fontSize: 10,
                                overflow:
                                  'hidden',
                              }}
                            >
                              {player.avatar_url ? (
                                <img
                                  src={
                                    player.avatar_url
                                  }
                                  alt=""
                                  style={{
                                    width:
                                      '100%',
                                    height:
                                      '100%',
                                    objectFit:
                                      'cover',
                                  }}
                                />
                              ) : (
                                player.name
                                  .charAt(
                                    0
                                  )
                                  .toUpperCase()
                              )}
                            </span>

                            {player.name}
                          </span>
                        </td>

                        <td>
                          {player.points.toLocaleString()}
                        </td>

                        <td
                          className={
                            change > 0
                              ? 'rank-up'
                              : change < 0
                                ? 'rank-down'
                                : ''
                          }
                        >
                          {change > 0
                            ? `↑ ${change}`
                            : change < 0
                              ? `↓ ${Math.abs(
                                  change
                                )}`
                              : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {game.status === 'waiting' && (
            <div
              className="small"
              style={{
                marginTop: 12,
                padding: '0 4px',
              }}
            >
              Rankings will appear after the
              first round is completed.
            </div>
          )}
        </>
      )}
    </AppShell>
  );
}
