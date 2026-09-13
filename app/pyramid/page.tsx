'use client';

import { useEffect, useState } from 'react';
import AppShell from '@/components/AppShell';
import Pyramid, {
  PyramidPlayer,
} from '@/components/Pyramid';
import { getSupabase } from '@/lib/supabase';

type Game = {
  id: string;
  name: string;
  room_code: string;
  status: 'waiting' | 'voting' | 'results' | 'finished';
  current_round: number;
  max_players: number;
};

type Round = {
  id: string;
  round_number: number;
  status: 'voting' | 'results' | 'closed';
};

type Ranking = {
  player_id: string;
  grade: 'A' | 'B' | 'C' | 'D' | 'E' | 'F';
  score: number;
};

type GamePlayer = {
  id: string;
  user_id: string;
  points: number;
};

type Profile = {
  id: string;
  display_name: string;
  avatar_url: string | null;
};

export default function PyramidPage() {
  const [players, setPlayers] = useState<PyramidPlayer[]>([]);
  const [game, setGame] = useState<Game | null>(null);
  const [round, setRound] = useState<Round | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function loadPyramid() {
    setLoading(true);
    setError('');

    const supabase = getSupabase();

    if (!supabase) {
      setError('Supabase is not configured.');
      setLoading(false);
      return;
    }

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setError('You must be signed in.');
        setLoading(false);
        return;
      }

      // Find the user's latest game membership.
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
        throw membershipError;
      }

      if (!membership) {
        setGame(null);
        setRound(null);
        setPlayers([]);
        setLoading(false);
        return;
      }

      // Load the game.
      const {
        data: gameData,
        error: gameError,
      } = await supabase
        .from('games')
        .select(
          'id,name,room_code,status,current_round,max_players'
        )
        .eq('id', membership.game_id)
        .maybeSingle();

      if (gameError) {
        throw gameError;
      }

      if (!gameData) {
        setGame(null);
        setRound(null);
        setPlayers([]);
        setLoading(false);
        return;
      }

      setGame(gameData as Game);

      // Find the latest completed round.
      //
      // During voting, the page intentionally shows
      // the previous completed Pyramid rather than
      // exposing unfinished grade calculations.
      const {
        data: roundData,
        error: roundError,
      } = await supabase
        .from('rounds')
        .select('id,round_number,status')
        .eq('game_id', gameData.id)
        .in('status', ['results', 'closed'])
        .order('round_number', {
          ascending: false,
        })
        .limit(1)
        .maybeSingle();

      if (roundError) {
        throw roundError;
      }

      if (!roundData) {
        setRound(null);
        setPlayers([]);
        setLoading(false);
        return;
      }

      setRound(roundData as Round);

      // Load the secure, server-generated rankings.
      //
      // IMPORTANT:
      // Raw votes are never requested by this page.
      const {
        data: rankingData,
        error: rankingError,
      } = await supabase
        .from('rankings')
        .select('player_id,grade,score')
        .eq('round_id', roundData.id)
        .order('rank', {
          ascending: true,
        });

      if (rankingError) {
        throw rankingError;
      }

      if (!rankingData || rankingData.length === 0) {
        setPlayers([]);
        setLoading(false);
        return;
      }

      const rankings = rankingData as Ranking[];

      const playerIds = rankings.map(
        (ranking) => ranking.player_id
      );

      // Load the corresponding game players.
      const {
        data: gamePlayers,
        error: playersError,
      } = await supabase
        .from('game_players')
        .select('id,user_id,points')
        .eq('game_id', gameData.id)
        .in('id', playerIds);

      if (playersError) {
        throw playersError;
      }

      const typedPlayers =
        (gamePlayers || []) as GamePlayer[];

      const userIds = typedPlayers.map(
        (player) => player.user_id
      );

      // Load public profile information only.
      const {
        data: profileData,
        error: profileError,
      } = await supabase
        .from('profiles')
        .select('id,display_name,avatar_url')
        .in('id', userIds);

      if (profileError) {
        throw profileError;
      }

      const profiles =
        (profileData || []) as Profile[];

      const playerMap = new Map(
        typedPlayers.map((player) => [
          player.id,
          player,
        ])
      );

      const profileMap = new Map(
        profiles.map((profile) => [
          profile.id,
          profile,
        ])
      );

      /*
       * Build the final PyramidPlayer[] explicitly.
       *
       * Using flatMap instead of map + filter avoids
       * the TypeScript 7 nullable type-predicate error.
       */
      const result: PyramidPlayer[] = rankings.flatMap(
        (ranking): PyramidPlayer[] => {
          const gamePlayer = playerMap.get(
            ranking.player_id
          );

          if (!gamePlayer) {
            return [];
          }

          const profile = profileMap.get(
            gamePlayer.user_id
          );

          const player: PyramidPlayer = {
            id: ranking.player_id,
            name:
              profile?.display_name || 'Player',
            avatarUrl:
              profile?.avatar_url ?? null,
            grade: ranking.grade,
            points: gamePlayer.points,
            isCurrentUser:
              gamePlayer.user_id === user.id,
          };

          return [player];
        }
      );

      setPlayers(result);
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load the Pyramid.'
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPyramid();
  }, []);

  const statusLabel =
    game?.status === 'finished'
      ? 'Finished'
      : game?.status === 'results'
        ? 'Results'
        : game?.status === 'voting'
          ? 'Voting'
          : 'Waiting';

  return (
    <AppShell>
      <div className="topbar">
        <div>
          <div className="eyebrow">
            RANKS REVEAL PEOPLE.
          </div>

          <h1 className="page-title">
            Current Pyramid
          </h1>

          <div className="sub">
            {game
              ? `${game.name} · ${game.room_code}`
              : 'Your current game'}
          </div>
        </div>

        <div className="top-actions">
          <span className="round-badge">
            {statusLabel}
          </span>
        </div>
      </div>

      {loading ? (
        <div className="card pyramid-page-state">
          <div className="pyramid-state-kicker">
            CALCULATING
          </div>

          <h2>Loading the Pyramid</h2>

          <p>
            Preparing the current grade hierarchy.
          </p>
        </div>
      ) : error ? (
        <div className="card pyramid-page-state">
          <div className="error">
            {error}
          </div>

          <button
            className="btn light"
            onClick={loadPyramid}
            style={{ marginTop: 16 }}
          >
            Try again
          </button>
        </div>
      ) : !game ? (
        <div className="card pyramid-page-state">
          <div className="pyramid-state-kicker">
            NO ACTIVE GAME
          </div>

          <h2>No Pyramid yet</h2>

          <p>
            Join or create a private game to enter
            the hierarchy.
          </p>
        </div>
      ) : !round || players.length === 0 ? (
        <div className="card pyramid-page-state">
          <div className="pyramid-empty-symbol">
            P
          </div>

          <div className="pyramid-state-kicker">
            THE PYRAMID HAS NOT FORMED
          </div>

          <h2>
            The hierarchy will emerge after Round 1.
          </h2>

          <p>
            Once a round is completed, the system
            will compare the voting distribution and
            automatically assign every player a grade
            from A to F.
          </p>

          <div className="pyramid-empty-note">
            No fixed vote thresholds. The group
            determines its own distribution.
          </div>
        </div>
      ) : (
        <div className="card pyramid-card-shell">
          <Pyramid
            players={players}
            roundNumber={round.round_number}
            totalPlayers={players.length}
          />
        </div>
      )}
    </AppShell>
  );
}
