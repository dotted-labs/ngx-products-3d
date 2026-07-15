/**
 * Vista mínima de lectura de un recurso async de Angular (`ResourceRef`/`Resource`):
 * el gate no-lanzante `hasValue()` más el `value()` (Signal invocable).
 */
export interface ReadableResource<T> {
	hasValue(): boolean;
	value(): T;
}

/**
 * Lectura SEGURA de un recurso: devuelve `value()` solo cuando `hasValue()` es `true`, si no
 * `undefined`. `Resource.value()` LANZA `ResourceValueError` en estado de error (y da `undefined`
 * en loading), así que gatear con `hasValue()` evita el throw durante la detección de cambios.
 */
export function resourceValueOrUndefined<T>(resource: ReadableResource<T>): T | undefined {
	return resource.hasValue() ? resource.value() : undefined;
}
