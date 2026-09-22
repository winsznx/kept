import { useQuery } from "convex/react";
import { useParams } from "react-router";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { TopBar } from "../components/Layouts";
import { Timeline } from "../features/items/ItemViews";

export default function ItemTimeline() {
  const { itemId } = useParams();
  const id = itemId as Id<"protectedItems">;
  const view = useQuery(api.items.getMine, { itemId: id });
  if (view === undefined)
    return (
      <div className="loading-block" role="status">
        <span className="spinner" /> Loading…
      </div>
    );
  return (
    <>
      <TopBar crumbs={[{ label: "My plans", to: "/app" }, { label: view.item.providerName ?? "Plan", to: `/app/items/${id}` }, { label: "Timeline" }]} />
      <div className="app-content">
        <div className="page-title">
          <div>
            <h1>Timeline</h1>
            <p>Every capture, reconciliation and case event for this plan, newest first.</p>
          </div>
        </div>
        <Timeline view={view} />
      </div>
    </>
  );
}
