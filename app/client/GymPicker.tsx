"use client";

export type GymOption = { id: number; name: string };

// Which gym this session is at, above the exercises. Machines differ from
// gym to gym, so the weights and "My notes" below follow the pick. The coach
// keeps the gym list; the client only picks from it, and only sees the row
// once there are two gyms to choose between.
export default function GymPicker({
  gyms,
  gymId,
  onPick,
}: {
  gyms: GymOption[];
  gymId: number | null;
  onPick: (gym: GymOption) => void;
}) {
  return (
    <div className="ts-gym">
      <span className="ts-gym-label">Which gym are you training at?</span>
      <div className="ts-gym-chips">
        {gyms.map((g) => (
          <button
            key={g.id}
            type="button"
            className={`ts-gym-chip${g.id === gymId ? " on" : ""}`}
            aria-pressed={g.id === gymId}
            onClick={() => g.id !== gymId && onPick(g)}
          >
            {g.name}
          </button>
        ))}
      </div>
    </div>
  );
}
