const STEPS = ["Record", "Watch", "Detect", "Resolve", "Verify"] as const;
export type LifecycleStep = (typeof STEPS)[number];

export function Lifecycle({ active }: { active?: LifecycleStep }) {
  return (
    <div className="lifecycle" aria-label="Promise lifecycle">
      {STEPS.map((s, i) => (
        <span key={s} data-active={s === active}>
          {s}
          {i < STEPS.length - 1 ? <span aria-hidden="true"> →</span> : null}
        </span>
      ))}
    </div>
  );
}
