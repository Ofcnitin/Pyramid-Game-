'use client';

export type PyramidPlayer = {
  id: string;
  name: string;
  avatarUrl?: string | null;
  grade: 'A' | 'B' | 'C' | 'D' | 'E' | 'F';
  points: number;
  isCurrentUser?: boolean;
};

type Props = {
  players: PyramidPlayer[];
  roundNumber: number;
  totalPlayers: number;
};

const GRADES: Array<{
  grade: PyramidPlayer['grade'];
  title: string;
  description: string;
}> = [
  {
    grade: 'A',
    title: 'Highest',
    description: 'Highest vote pressure',
  },
  {
    grade: 'B',
    title: 'High',
    description: 'Strong vote pressure',
  },
  {
    grade: 'C',
    title: 'Above Average',
    description: 'Above the group midpoint',
  },
  {
    grade: 'D',
    title: 'Below Average',
    description: 'Below the group midpoint',
  },
  {
    grade: 'E',
    title: 'Low',
    description: 'Low vote pressure',
  },
  {
    grade: 'F',
    title: 'Lowest',
    description: 'Lowest or no votes',
  },
];

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) return '?';

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return (
    parts[0].charAt(0) +
    parts[parts.length - 1].charAt(0)
  ).toUpperCase();
}

function GradeAvatar({
  player,
}: {
  player: PyramidPlayer;
}) {
  if (player.avatarUrl) {
    return (
      <img
        className="pyramid-player-avatar"
        src={player.avatarUrl}
        alt=""
      />
    );
  }

  return (
    <div className="pyramid-player-avatar pyramid-player-avatar-fallback">
      {initials(player.name)}
    </div>
  );
}

function PlayerCard({
  player,
}: {
  player: PyramidPlayer;
}) {
  return (
    <div
      className={`pyramid-player ${
        player.isCurrentUser ? 'is-current-user' : ''
      }`}
    >
      <GradeAvatar player={player} />

      <div className="pyramid-player-info">
        <div className="pyramid-player-name">
          {player.name}
          {player.isCurrentUser && (
            <span className="pyramid-you">YOU</span>
          )}
        </div>

        <div className="pyramid-player-points">
          {player.points} points
        </div>
      </div>

      <div className="pyramid-player-grade">
        {player.grade}
      </div>
    </div>
  );
}

export default function Pyramid({
  players,
  roundNumber,
  totalPlayers,
}: Props) {
  const grouped = GRADES.map((group) => ({
    ...group,
    players: players
      .filter((player) => player.grade === group.grade)
      .sort((a, b) => b.points - a.points),
  }));

  return (
    <div className="pyramid-board">

      <div className="pyramid-board-header">
        <div>
          <div className="pyramid-board-eyebrow">
            SOCIAL HIERARCHY
          </div>

          <h2 className="pyramid-board-title">
            The Pyramid
          </h2>

          <p className="pyramid-board-subtitle">
            Round {roundNumber} · {totalPlayers} players
          </p>
        </div>

        <div className="pyramid-scale">
          <span>A</span>
          <span className="pyramid-scale-line" />
          <span>F</span>
        </div>
      </div>

      <div className="pyramid-grade-list">
        {grouped.map((group) => (
          <section
            className={`pyramid-grade-section grade-${group.grade.toLowerCase()}`}
            key={group.grade}
          >
            <div className="pyramid-grade-marker">
              <div className="pyramid-grade-letter">
                {group.grade}
              </div>

              <div className="pyramid-grade-meta">
                <strong>{group.title}</strong>
                <span>{group.description}</span>
              </div>
            </div>

            <div className="pyramid-grade-players">
              {group.players.length > 0 ? (
                group.players.map((player) => (
                  <PlayerCard
                    key={player.id}
                    player={player}
                  />
                ))
              ) : (
                <div className="pyramid-grade-empty">
                  No players
                </div>
              )}
            </div>
          </section>
        ))}
      </div>

      <div className="pyramid-board-footer">
        <span>
          Grades are calculated automatically from the
          round&apos;s voting distribution.
        </span>

        <span>
          A = highest vote pressure · F = lowest
        </span>
      </div>
    </div>
  );
}
