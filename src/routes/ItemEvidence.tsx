import { useConvex, useQuery } from "convex/react";
import { useState } from "react";
import { useParams } from "react-router";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { TopBar } from "../components/Layouts";
import { PageComparisons, SourceList, ThenVsNow } from "../features/items/ItemViews";

export default function ItemEvidence() {
  const { itemId } = useParams();
  const id = itemId as Id<"protectedItems">;
  const view = useQuery(api.items.getMine, { itemId: id });
  const convex = useConvex();
  const [text, setText] = useState<{ id: string; text: string; truncated: boolean } | null>(null);
  if (view === undefined)
    return (
      <div className="loading-block" role="status">
        <span className="spinner" /> Loading…
      </div>
    );
  return (
    <>
      <TopBar crumbs={[{ label: "My plans", to: "/app" }, { label: view.item.providerName ?? "Plan", to: `/app/items/${id}` }, { label: "Then vs Now" }]} />
      <div className="app-content">
      <ThenVsNow view={view} />
      <PageComparisons view={view} />
      <SourceList
        view={view}
        loadText={(captureId) => {
          void convex.query(api.items.captureText, { itemId: id, captureId }).then((r) => setText(r ? { id: captureId, ...r } : null));
        }}
      />
      {text ? (
        <section className="stack">
          <h3 style={{ margin: 0 }}>Source text</h3>
          <pre className="excerpt small" style={{ maxHeight: 420, overflow: "auto", fontFamily: "inherit" }}>
            {text.text}
          </pre>
          {text.truncated ? <p className="muted small">Showing the first 30,000 characters.</p> : null}
        </section>
      ) : null}
      </div>
    </>
  );
}
