import type { InputHTMLAttributes } from "react";

interface FormFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  id: string;
  label: string;
}

export function FormField({ id, label, type = "text", ...props }: FormFieldProps) {
  return (
    <div>
      <label
        htmlFor={id}
        className="block text-xs uppercase tracking-wide text-muted"
      >
        {label}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        className="mt-1 w-full rounded-sm border border-line bg-ink px-3 py-2 text-sm text-paper outline-none focus:border-pos-forward"
        {...props}
      />
    </div>
  );
}
