"use client";

import { X } from "lucide-react";
import {
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type RenderRow<T extends { id: string }> = (row: T, isSelected: boolean) => ReactNode;

type RenderPanel<T extends { id: string }> = (row: T, closePanel: () => void) => ReactNode;

type Props<T extends { id: string }> = {
  records: readonly T[];
  listHeading: ReactNode;
  renderRow: RenderRow<T>;
  renderPanel: RenderPanel<T>;
  renderPanelTitle: (row: T) => ReactNode;
  emptyMessage?: string;
  className?: string;
  initialRecordId?: string | null;
};

export function RecordDetailWorkspace<T extends { id: string }>({
  records,
  listHeading,
  renderRow,
  renderPanel,
  renderPanelTitle,
  emptyMessage = "No records to display.",
  className,
  initialRecordId,
}: Props<T>) {
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(initialRecordId ?? null);
  const selectedRecord = useMemo(
    () => records.find((record) => record.id === selectedRecordId),
    [records, selectedRecordId],
  );
  const focusReturnId = useRef<string | null>(null);
  const rowRefs = useRef(new Map<string, HTMLButtonElement | null>());

  useEffect(() => {
    if (!records.length) {
      setSelectedRecordId((current) => (current === null ? null : null));
      return;
    }

    if (selectedRecordId && !records.find((row) => row.id === selectedRecordId)) {
      setSelectedRecordId(records[0]?.id ?? null);
    }
  }, [records, selectedRecordId]);

  useEffect(() => {
    if (selectedRecordId === null) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closePanel();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [selectedRecordId]);

  const openRecord = (recordId: string) => {
    focusReturnId.current = recordId;
    setSelectedRecordId(recordId);
  };

  const closePanel = () => {
    const returnId = focusReturnId.current;
    setSelectedRecordId((current) => {
      if (current === null) {
        return null;
      }

      return null;
    });

    if (returnId) {
      requestAnimationFrame(() => {
        const rowButton = rowRefs.current.get(returnId);
        rowButton?.focus();
      });
    }
  };

  return (
    <div className={className ?? "workspace-grid"}>
      <section className="content-section span-2">
        <div className="section-heading">
          {listHeading}
        </div>
        <div className="record-list">
          {records.length === 0 ? (
            <p className="record-list-empty">{emptyMessage}</p>
          ) : (
      records.map((record) => {
              const isSelected = selectedRecordId === record.id;

              return (
                <button
                  key={record.id}
                  type="button"
                  ref={(node) => {
                    if (!node) {
                      rowRefs.current.delete(record.id);
                    } else {
                      rowRefs.current.set(record.id, node);
                    }
                  }}
                  className={`record-row ${isSelected ? "record-row-selected" : ""}`}
                  aria-expanded={isSelected}
                  aria-current={isSelected ? "page" : undefined}
                  aria-controls="record-detail-panel"
                  onClick={() => openRecord(record.id)}
                >
                  {renderRow(record, isSelected)}
                </button>
              );
            })
          )}
        </div>
      </section>

      {selectedRecord ? (
        <aside className="content-section record-detail-panel" id="record-detail-panel" aria-live="polite">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Record</p>
              <h2>{renderPanelTitle(selectedRecord)}</h2>
            </div>
            <button className="secondary-button" type="button" onClick={closePanel}>
              <X className="size-4" aria-hidden="true" />
              Close
            </button>
          </div>
          <div className="record-detail-panel-content">{renderPanel(selectedRecord, closePanel)}</div>
        </aside>
      ) : null}
    </div>
  );
}
