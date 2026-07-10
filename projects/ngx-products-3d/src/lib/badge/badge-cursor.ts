/** Valores de `cursor` que la escena del badge aplica al `document.body`. */
export type BadgeCursor = 'grabbing' | 'grab' | 'auto';

/** Cursor del badge según estado: drag → 'grabbing', hover → 'grab', reposo → 'auto' (prioridad drag > hover). */
export function cursorFor(dragged: boolean, hovered: boolean): BadgeCursor {
	return dragged ? 'grabbing' : hovered ? 'grab' : 'auto';
}
