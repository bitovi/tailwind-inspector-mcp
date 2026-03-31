import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-button',
  standalone: true,
  template: `<button [class]="base + ' ' + styles()">
    <ng-content />
  </button>`,
})
export class ButtonComponent {
  @Input({ required: true }) variant!: 'primary' | 'secondary';

  protected readonly base = 'px-4 py-2 rounded-md text-sm font-medium transition-colors';

  protected styles() {
    return this.variant === 'primary'
      ? 'bg-indigo-600 text-white hover:bg-indigo-700'
      : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50';
  }
}
