import { TestBed } from '@angular/core/testing';

import { FilterDisclosureComponent } from './filter-disclosure.component';

describe('Filtros adaptables: interacción y cambio de ancho', () => {
  it('comienza plegado en móvil y permite abrir/cerrar con el control nativo', async () => {
    const fixture = TestBed.createComponent(FilterDisclosureComponent);
    fixture.detectChanges();
    const details = fixture.nativeElement.querySelector('details') as HTMLDetailsElement;
    expect(details.open).toBe(false);
    details.open = true;
    details.dispatchEvent(new Event('toggle'));
    fixture.detectChanges();
    expect(fixture.componentInstance.expanded()).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('Ocultar filtros');
    details.open = false;
    details.dispatchEvent(new Event('toggle'));
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Mostrar filtros');
  });
  it('se adapta al breakpoint y retira el listener al destruir la pantalla', () => {
    let matches = true;
    const listeners = new EventTarget();
    const remove = vi.spyOn(listeners, 'removeEventListener');
    const media = {
      get matches() {
        return matches;
      },
      addEventListener: listeners.addEventListener.bind(listeners),
      removeEventListener: listeners.removeEventListener.bind(listeners),
    } as MediaQueryList;
    const query = vi.spyOn(window, 'matchMedia').mockReturnValue(media);
    const fixture = TestBed.createComponent(FilterDisclosureComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance.expanded()).toBe(true);
    matches = false;
    listeners.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(fixture.componentInstance.expanded()).toBe(false);
    fixture.destroy();
    expect(remove).toHaveBeenCalled();
    query.mockRestore();
  });
});
