import { useState } from "react";

interface UseUncontrolledInput<T> {
  /** Value for controlled state */
  value?: T;

  /** Initial value for uncontrolled state */
  defaultValue?: T;

  /** Final value for uncontrolled state when value and defaultValue are not provided */
  finalValue?: T;

  /** Controlled state onChange handler */
  onChange?: (value: T, ...payload: any[]) => void;
}

export default function useUncontrolled<T>({
  value,
  defaultValue,
  finalValue,
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  onChange = () => {},
}: UseUncontrolledInput<T>): [
  T,
  (value: T, ...payload: any[]) => void,
  boolean
] {
  const [uncontrolledValue, setUncontrolledValue] = useState(
    defaultValue !== undefined ? defaultValue : finalValue
  );

  const handleUncontrolledChange = (val: T, ...payload: any[]) => {
    setUncontrolledValue(val);
    onChange?.(val, ...payload);
  };

  if (value !== undefined) {
    return [value as T, onChange, true];
  }

  return [uncontrolledValue as T, handleUncontrolledChange, false];
}
