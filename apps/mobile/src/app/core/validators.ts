import type { AbstractControl, ValidatorFn } from '@angular/forms';

export const DOCUMENT_PATTERN = /^[A-Za-z0-9][A-Za-z0-9.-]{2,39}$/;
export const documentValidator: ValidatorFn = (control) =>
  DOCUMENT_PATTERN.test(String(control.value ?? '').trim()) ? null : { document: true };
export const trimmedLength =
  (min: number, max: number): ValidatorFn =>
  (control) => {
    const length = [...String(control.value ?? '').trim()].length;
    return length >= min && length <= max ? null : { trimmedLength: true };
  };
export const noControlCharacters: ValidatorFn = (control) =>
  [...String(control.value)].some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)
    ? { controlCharacters: true }
    : null;
export const integer: ValidatorFn = (control: AbstractControl) =>
  control.value === null || Number.isInteger(control.value) ? null : { integer: true };
