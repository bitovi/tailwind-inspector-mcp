import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-input',
  standalone: true,
  template: `<div class="flex flex-col gap-1.5">
    <label class="text-sm font-medium text-gray-700">{{ label }}</label>
    <input
      [type]="type"
      [placeholder]="placeholder"
      class="px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
    />
  </div>`,
})
export class InputComponent {
  @Input({ required: true }) label!: string;
  @Input() placeholder: string = '';
  @Input() type: 'text' | 'email' | 'number' | 'tel' | 'url' = 'text';
}
