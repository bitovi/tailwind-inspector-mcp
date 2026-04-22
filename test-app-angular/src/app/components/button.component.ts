import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-button',
  standalone: true,
  template: `<button [class]="base + ' ' + styles()">
    <ng-content select="[leftIcon]" />
    <ng-content />
    <ng-content select="[rightIcon]" />
  </button>`,
})
export class ButtonComponent {
  @Input({ required: true }) variant!: 'primary' | 'secondary' | 'warning';

  protected readonly base = 'inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors';

  protected styles() {
    switch (this.variant) {
      case 'primary':
        return 'bg-indigo-600 text-white hover:bg-indigo-700';
      case 'warning':
        return 'bg-amber-500 text-white hover:bg-amber-600';
      default:
        return 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50';
    }
  }
}
