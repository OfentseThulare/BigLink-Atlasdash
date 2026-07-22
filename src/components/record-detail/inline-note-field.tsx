"use client";

import { useEffect, useRef } from "react";
import { updateRecordNotesAction } from "@/lib/portal/actions";

type EditableFieldName = "description" | "reason" | "reference" | "proposedResolution";

type Props = {
  recordType: "ledger_entry" | "dispute";
  recordId: string;
  returnPath: string;
  fieldName: EditableFieldName;
  label: string;
  value: string;
  placeholder?: string;
  multiline?: boolean;
  rows?: number;
  disabled?: boolean;
  allowEmpty?: boolean;
  className?: string;
};

export function InlineNoteField({
  recordType,
  recordId,
  returnPath,
  fieldName,
  label,
  value,
  placeholder,
  multiline,
  rows,
  disabled,
  allowEmpty,
  className,
}: Props) {
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const committedValue = useRef(value);

  useEffect(() => {
    committedValue.current = value;
    if (inputRef.current) {
      inputRef.current.value = value;
    }
  }, [value]);

  const submitIfChanged = () => {
    const nextValue = (inputRef.current?.value ?? "").trim();

    if (nextValue === committedValue.current.trim() || disabled) {
      return;
    }

    if (!allowEmpty && nextValue.length === 0) {
      return;
    }

    committedValue.current = nextValue;
    if (!formRef.current) {
      return;
    }

    formRef.current.requestSubmit();
  };

  return (
    <form
      ref={formRef}
      action={updateRecordNotesAction}
      className={className ?? "action-form inline-note-field"}
    >
      <label>
        <span>{label}</span>
        <input type="hidden" name="returnPath" value={returnPath} />
        <input type="hidden" name="recordType" value={recordType} />
        <input type="hidden" name="recordId" value={recordId} />
      {multiline ? (
          <textarea
            ref={(node) => {
              inputRef.current = node;
            }}
            name={fieldName}
            className="text-field"
            rows={rows}
            placeholder={placeholder}
            defaultValue={value}
            onBlur={submitIfChanged}
            maxLength={fieldName === "reason" ? 2000 : fieldName === "proposedResolution" ? 2000 : 120}
            disabled={disabled}
          />
        ) : (
          <input
            ref={(node) => {
              inputRef.current = node;
            }}
            name={fieldName}
            className="text-field"
            defaultValue={value}
            placeholder={placeholder}
            maxLength={fieldName === "reason" ? 2000 : fieldName === "proposedResolution" ? 2000 : 120}
            onBlur={submitIfChanged}
            disabled={disabled}
          />
        )}
      </label>
    </form>
  );
}
