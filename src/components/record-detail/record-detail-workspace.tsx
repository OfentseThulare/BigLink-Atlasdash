"use client";

import { X } from "lucide-react";
import {
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type RenderRow<T extends { id: string }> = (
  row: T,
  isSelected: boolean,
  openRecord: (recordId: string, actionHint?: string | null) => void,
) => ReactNode;

type RenderPanel<T extends { id: string }> = (
  row: T,
  closePanel: () => void,
  actionHint?: string | null,
) => ReactNode;

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
  const [selectedRecordAction, setSelectedRecordAction] = useState<string | null>(null);
  const selectedRecord = useMemo(
    () => records.find((record) => record.id === selectedRecordId),
    [records, selectedRecordId],
  );
  const focusReturnId = useRef<string | null>(null);
  const rowRefs = useRef(new Map<string, HTMLDivElement | null>());

  useEffect(() => {
    if (!records.length) {
      setSelectedRecordId(null);
      setSelectedRecordAction(null);
      return;
    }

    if (selectedRecordId && !records.find((row) => row.id === selectedRecordId)) {
      setSelectedRecordId(records[0]?.id ?? null);
      setSelectedRecordAction(null);
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

  useEffect(() => {
    if (selectedRecordId === null || selectedRecordAction === null) {
      return;
    }

    requestAnimationFrame(() => {
      const selector = `[data-record-action-focus="${selectedRecordId}:${selectedRecordAction}"]`;
      const field = document.querySelector<HTMLElement>(selector);
      field?.focus();
    });
  }, [selectedRecordId, selectedRecordAction]);

  const openRecord = (recordId: string, actionHint: string | null = null) => {
    focusReturnId.current = recordId;
    setSelectedRecordId(recordId);
    setSelectedRecordAction(actionHint);
  };

  const closePanel = () => {
    const returnId = focusReturnId.current;
    setSelectedRecordId(null);
    setSelectedRecordAction(null);

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

              const onRowKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
                if (event.target !== event.currentTarget) {
                  return;
                }

                if (event.key !== "Enter" && event.key !== " ") {
                  return;
                }

                event.preventDefault();
                openRecord(record.id);
              };

              return (
                <div
                  key={record.id}
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
                  role="button"
                  tabIndex={0}
                  onClick={() => openRecord(record.id)}
                  onKeyDown={onRowKeyDown}
                >
                  {renderRow(record, isSelected, openRecord)}
                </div>
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
          <div className="record-detail-panel-content">
            {renderPanel(selectedRecord, closePanel, selectedRecordAction)}
          </div>
        </aside>
      ) : null}
    </div>
  );
}
