import { Icon, type IconName } from "./Icon";

const STEPS: { label: LifecycleStep; icon: IconName }[] = [
  { label: "Record", icon: "record" },
  { label: "Watch", icon: "watch" },
  { label: "Detect", icon: "detect" },
  { label: "Resolve", icon: "email" },
  { label: "Verify", icon: "verify" },
];
export type LifecycleStep = "Record" | "Watch" | "Detect" | "Resolve" | "Verify";

/** The product loop. Steps before `active` are done; `complete` marks every step done. */
export function Lifecycle({ active, complete = false }: { active?: LifecycleStep; complete?: boolean }) {
  const activeIndex = active ? STEPS.findIndex((s) => s.label === active) : -1;
  return (
    <ol className="lifecycle" aria-label="Promise lifecycle" style={{ listStyle: "none", padding: 0, margin: 0 }}>
      {STEPS.map((s, i) => {
        const state = complete || i < activeIndex ? "done" : i === activeIndex ? "active" : "todo";
        return (
          <li key={s.label} className="lifecycle-step" data-state={state} aria-current={state === "active" ? "step" : undefined}>
            <Icon name={state === "done" ? "resolve" : s.icon} size={16} />
            <span>{s.label}</span>
            <span className="num">0{i + 1}</span>
          </li>
        );
      })}
    </ol>
  );
}
