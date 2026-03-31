import { Component, Input } from '@angular/core';
import { BadgeComponent } from './badge.component';

@Component({
  selector: 'app-card',
  standalone: true,
  imports: [BadgeComponent],
  template: `
    <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
      <div class="flex items-center justify-between mb-3">
        <h3 class="text-base font-semibold text-gray-900">{{ title }}</h3>
        <app-badge color="blue">{{ tag }}</app-badge>
      </div>
      <p class="text-sm text-gray-600">{{ description }}</p>
    </div>
  `,
})
export class CardComponent {
  @Input({ required: true }) title!: string;
  @Input({ required: true }) description!: string;
  @Input({ required: true }) tag!: string;
}
