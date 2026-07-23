"use client";

import { type FormEvent, type MouseEvent, type ReactNode } from "react";

type BaseProps = {
  label: string;
  className?: string;
};

type ReasonActionProps = {
  reason: string;
};

type OpenActionProps = BaseProps & {
  mode: "open";
  onActivate: (event: MouseEvent<HTMLButtonElement>) => void;
};

type ConfirmActionProps = BaseProps & {
  mode: "confirm";
  action: (formData: FormData) => Promise<void>;
  confirmMessage: string;
  children?: ReactNode;
};

type RowActionProps = ReasonActionProps | OpenActionProps | ConfirmActionProps;

export function RowAction(props: RowActionProps) {
  if ("reason" in props) {
    return <p className="record-row-reason record-row-action">{props.reason}</p>;
  }

  if (props.mode === "open") {
    const handleActivate = (event: MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      props.onActivate(event);
    };

    return (
      <button
        className={`primary-button row-action-button row-action ${props.className ?? ""}`}
        type="button"
        onClick={handleActivate}
      >
        {props.label}
      </button>
    );
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.stopPropagation();

    if (!window.confirm(props.confirmMessage)) {
      event.preventDefault();
    }
  };

  return (
    <form action={props.action} onSubmit={handleSubmit} className="row-action-form row-action">
      {props.children}
      <button
        className={`primary-button row-action-button ${props.className ?? ""}`}
        type="submit"
        onClick={(event) => {
          event.stopPropagation();
        }}
      >
        {props.label}
      </button>
    </form>
  );
}
