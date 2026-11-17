import { Component, input } from '@angular/core';

@Component({
  selector: 'app-page-header',
  template: `
    <header class="page-heading">
      <div>
        <span class="eyebrow">{{ eyebrow() }}</span>
        <h1>{{ title() }}</h1>
        <p>{{ subtitle() }}</p>
      </div>
      <div class="page-heading-actions"><ng-content /></div>
    </header>
  `,
})
export class PageHeaderComponent {
  readonly eyebrow = input('SIT-CAMA');
  readonly title = input.required<string>();
  readonly subtitle = input('');
}
