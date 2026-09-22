import { useQuery } from "convex/react";
import { Link, useParams } from "react-router";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { Timeline } from "../features/items/ItemViews";

export default function ItemTimeline() {
  const { itemId } = useParams();
  const id = itemId as Id<"protectedItems">;
  const view = useQuery(api.items.getMine, { itemId: id });
  if (view === undefined) return <p role="status">Loading…</p>;
  return (
    <div className="stack">
      <Link to={`/app/items/${id}`} className="small">
        ← Back to item
      </Link>
      <h1>Timeline</h1>
      <Timeline view={view} />
    </div>
  );
}
