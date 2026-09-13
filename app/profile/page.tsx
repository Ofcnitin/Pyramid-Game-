'use client';

import { useEffect, useState } from 'react';
import AppShell from '@/components/AppShell';
import { getSupabase } from '@/lib/supabase';

type Profile = {
  display_name: string;
  avatar_url: string | null;
};

type Player = {
  id: string;
  game_id: string;
  current_rank: number | null;
  previous_rank: number | null;
  points: number;
  joined_at: string;
};

type Game = {
  id: string;
  name: string;
  room_code: string;
  status: 'waiting' | 'voting' | 'results' | 'finished';
  current_round: number;
};

type Round = {
  id: string;
  round_number: number;
  status: string;
  starts_at: string;
  ends_at: string;
};

type Ranking = {
  round_id: string;
  player_id: string;
  rank: number;
  score: number;
  previous_rank: number | null;
};

type HistoryItem = {
  round: number;
  rank: number;
  previousRank: number | null;
  score: number;
};

export default function ProfilePage() {
  const [tab, setTab] = useState('Stats');

  const [profile, setProfile] = useState<Profile | null>(
    null
  );

  const [player, setPlayer] = useState<Player | null>(
    null
  );

  const [game, setGame] = useState<Game | null>(null);

  const [history, setHistory] = useState<
    HistoryItem[]
  >([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadProfile() {
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

      const { data: profileData } = await supabase
        .from('profiles')
        .select('display_name,avatar_url')
        .eq('id', user.id)
        .maybeSingle();

      if (profileData) {
        setProfile(profileData as Profile);
      }

      const { data: playerData, error: playerError } =
        await supabase
          .from('game_players')
          .select(
            'id,game_id,current_rank,previous_rank,points,joined_at'
          )
          .eq('user_id', user.id)
          .order('joined_at', {
            ascending: false,
          })
          .limit(1)
          .maybeSingle();

      if (playerError) {
        setError(
          'Unable to load your game membership.'
        );
        setLoading(false);
        return;
      }

      if (!playerData) {
        setLoading(false);
        return;
      }

      setPlayer(playerData as Player);

      const { data: gameData, error: gameError } =
        await supabase
          .from('games')
          .select(
            'id,name,room_code,status,current_round'
          )
          .eq('id', playerData.game_id)
          .maybeSingle();

      if (gameError || !gameData) {
        setError('Unable to load your game.');
        setLoading(false);
        return;
      }

      setGame(gameData as Game);

      const { data: rounds } = await supabase
        .from('rounds')
        .select(
          'id,round_number,status,starts_at,ends_at'
        )
        .eq('game_id', playerData.game_id)
        .order('round_number', {
          ascending: false,
        });

      if (rounds && rounds.length > 0) {
        const roundIds = rounds.map(
          (round: Round) => round.id
        );

        const { data: rankings } = await supabase
          .from('rankings')
          .select(
            'round_id,player_id,rank,score,previous_rank'
          )
          .eq('player_id', playerData.id)
          .in('round_id', roundIds);

        const rankingRows =
          (rankings || []) as Ranking[];

        const historyRows: HistoryItem[] =
          (rounds as Round[])
            .map((round) => {
              const ranking = rankingRows.find(
                (item) =>
                  item.round_id === round.id
              );

              if (!ranking) {
                return null;
              }

              return {
                round: round.round_number,
                rank: ranking.rank,
                previousRank:
                  ranking.previous_rank,
                score: ranking.score,
              };
            })
            .filter(
              (
                item
              ): item is HistoryItem => item !== null
            );

        setHistory(historyRows);
      }

      setLoading(false);
    }

    loadProfile();
  }, []);

  if (loading) {
    return (
      <AppShell>
        <div className="empty">
          Loading your profile…
        </div>
      </AppShell>
    );
  }

  const displayName =
    profile?.display_name || 'Player';

  const initial =
    displayName.charAt(0).toUpperCase();

  const currentRank =
    player?.current_rank != null
      ? `#${player.current_rank}`
      : 'Unranked';

  const points = player?.points ?? 0;

  const currentRound =
    game?.current_round ?? 0;

  const rankChange =
    player?.current_rank != null &&
    player?.previous_rank != null
      ? player.previous_rank -
        player.current_rank
      : 0;

  return (
    <AppShell>
      <div className="topbar">
        <div>
          <h1 className="page-title">
            Profile
          </h1>

          <div className="sub">
            Your place in the hierarchy, recorded.
          </div>
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

      <div className="card profile-head">
        <div
          className="profile-avatar"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 28,
            fontFamily: 'Georgia, serif',
          }}
        >
          {initial}
        </div>

        <div>
          <div className="profile-name">
            {displayName}
          </div>

          <div className="small">
            {currentRank} ·{' '}
            {game
              ? game.name
              : 'No active game'}
          </div>
        </div>

        <div className="profile-stat">
          <span className="small">
            Points
          </span>

          <strong>
            {points.toLocaleString()}
          </strong>
        </div>

        <div className="profile-stat">
          <span className="small">
            Current Round
          </span>

          <strong>
            {currentRound || '—'}
          </strong>
        </div>

        <div className="profile-stat">
          <span className="small">
            Current Rank
          </span>

          <strong>
            {currentRank}
          </strong>
        </div>
      </div>

      {game && (
        <div
          className="card"
          style={{
            marginTop: 16,
            padding: 20,
          }}
        >
          <div className="eyebrow">
            CURRENT GAME
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent:
                'space-between',
              alignItems: 'center',
              gap: 16,
              flexWrap: 'wrap',
            }}
          >
            <div>
              <h2
                className="serif"
                style={{
                  fontSize: 25,
                  margin: '6px 0',
                }}
              >
                {game.name}
              </h2>

              <div className="small">
                Private room ·{' '}
                {game.room_code}
              </div>
            </div>

            <div className="round-badge">
              {game.status === 'waiting'
                ? 'Waiting'
                : game.status === 'voting'
                  ? 'Voting'
                  : game.status ===
                      'results'
                    ? 'Results'
                    : 'Finished'}
            </div>
          </div>
        </div>
      )}

      <div
        className="card"
        style={{
          marginTop: 16,
          padding: '0 18px',
        }}
      >
        <div className="tabs">
          {[
            'Stats',
            'History',
            'Achievements',
          ].map((item) => (
            <button
              key={item}
              className={
                tab === item
                  ? 'active'
                  : ''
              }
              onClick={() =>
                setTab(item)
              }
            >
              {item}
            </button>
          ))}
        </div>

        {tab === 'Stats' && (
          <div
            style={{
              padding: '22px 4px',
            }}
          >
            <div className="grid3">
              <div className="card stat">
                <div className="eyebrow">
                  POINTS
                </div>

                <div className="value">
                  {points.toLocaleString()}
                </div>

                <div className="muted">
                  Current game
                </div>
              </div>

              <div className="card stat">
                <div className="eyebrow">
                  CURRENT RANK
                </div>

                <div className="value">
                  {currentRank}
                </div>

                <div className="muted">
                  {rankChange > 0
                    ? `↑ ${rankChange} this round`
                    : rankChange < 0
                      ? `↓ ${Math.abs(
                          rankChange
                        )} this round`
                      : 'No change yet'}
                </div>
              </div>

              <div className="card stat">
                <div className="eyebrow">
                  ROUNDS PLAYED
                </div>

                <div className="value">
                  {history.length}
                </div>

                <div className="muted">
                  Recorded results
                </div>
              </div>
            </div>

            {!game && (
              <div
                className="empty"
                style={{
                  marginTop: 20,
                }}
              >
                Join or create a game to
                start building your profile
                statistics.
              </div>
            )}
          </div>
        )}

        {tab === 'History' && (
          <div
            style={{
              padding: '10px 0',
            }}
          >
            {history.length === 0 ? (
              <div className="empty">
                No completed rounds yet.
              </div>
            ) : (
              history.map((item) => {
                const change =
                  item.previousRank !=
                    null
                    ? item.previousRank -
                      item.rank
                    : 0;

                return (
                  <div
                    key={item.round}
                    style={{
                      display: 'grid',
                      gridTemplateColumns:
                        '90px 1fr 90px',
                      gap: 12,
                      alignItems:
                        'center',
                      padding:
                        '16px 4px',
                      borderBottom:
                        '1px solid #eee',
                    }}
                  >
                    <b>
                      Round {item.round}
                    </b>

                    <span>
                      Rank{' '}
                      <strong>
                        #{item.rank}
                      </strong>

                      {change !== 0 && (
                        <>
                          {' · '}
                          <span
                            className={
                              change > 0
                                ? 'rank-up'
                                : 'rank-down'
                            }
                          >
                            {change > 0
                              ? `↑ ${change}`
                              : `↓ ${Math.abs(
                                  change
                                )}`}
                          </span>
                        </>
                      )}

                      <br />

                      <span className="small">
                        {item.score}{' '}
                        votes received
                      </span>
                    </span>

                    <span className="small">
                      Recorded
                    </span>
                  </div>
                );
              })
            )}
          </div>
        )}

        {tab === 'Achievements' && (
          <div
            style={{
              padding: '24px 4px',
            }}
          >
            <div className="grid3">
              <div className="card stat">
                <div className="eyebrow">
                  FIRST ROUND
                </div>

                <div
                  className="value"
                  style={{
                    fontSize: 22,
                  }}
                >
                  {history.length > 0
                    ? 'Unlocked'
                    : 'Locked'}
                </div>

                <div className="muted">
                  Complete your first
                  round
                </div>
              </div>

              <div className="card stat">
                <div className="eyebrow">
                  RANKED
                </div>

                <div
                  className="value"
                  style={{
                    fontSize: 22,
                  }}
                >
                  {player?.current_rank !=
                  null
                    ? 'Unlocked'
                    : 'Locked'}
                </div>

                <div className="muted">
                  Receive your first
                  ranking
                </div>
              </div>

              <div className="card stat">
                <div className="eyebrow">
                  VETERAN
                </div>

                <div
                  className="value"
                  style={{
                    fontSize: 22,
                  }}
                >
                  {history.length >=
                  5
                    ? 'Unlocked'
                    : 'Locked'}
                </div>

                <div className="muted">
                  Complete 5 rounds
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
