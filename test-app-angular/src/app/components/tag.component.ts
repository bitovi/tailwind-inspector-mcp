import { Component, Input } from '@angular/core';

const colorClasses: Record<string, string> = {
  blue: 'bg-blue-100',
  red: 'bg-red-100',
  green: 'bg-green-100',
};

@Component({
  selector: 'app-tag',
  standalone: true,
  template: `<span [class]="'inline-block px-3 py-1 rounded text-sm font-medium ' + colorClasses[color]">
    <ng-content />
  </span>`,
})
export class TagComponent {
  @Input({ required: true }) color!: 'blue' | 'red' | 'green';
  protected readonly colorClasses = colorClasses;
}
