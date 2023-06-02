export interface TypedFormData<T extends { [key: string]: any }>
  extends FormData {
  append<K extends keyof T>(name: K, value: T[K]): void;
}
