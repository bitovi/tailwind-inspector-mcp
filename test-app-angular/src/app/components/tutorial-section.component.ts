import { Component, Input, Output, EventEmitter } from '@angular/core';
import { NgIf } from '@angular/common';

@Component({
  selector: 'app-tutorial-section',
  standalone: true,
  imports: [NgIf],
  template: `
    <section [class]="'rounded-lg shadow-sm border overflow-hidden ' +
      (completed ? 'bg-green-100 border-green-300' : 'bg-white border-gray-200')">

      <!-- Header -->
      <div class="flex items-center gap-3 px-6 py-4 border-b border-gray-100">
        <span [class]="'flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold shrink-0 ' +
          (completed ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500')">
          <svg *ngIf="completed" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
            <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          <ng-container *ngIf="!completed">{{ step }}</ng-container>
        </span>

        <h2 class="text-lg font-semibold text-gray-900 flex-1">{{ title }}</h2>

        <span *ngIf="completed" class="text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-full">
          Done
        </span>
      </div>

      <!-- Body -->
      <div class="px-6 py-5">
        <!-- Instructions -->
        <div class="text-sm text-gray-600 leading-relaxed mb-5">
          <ng-content select="[instructions]" />
        </div>

        <!-- Playground -->
        <div [class]="playgroundClassName">
          <ng-content />
        </div>

        <!-- Fallback button -->
        <div *ngIf="!completed" class="mt-4 flex justify-end">
          <button
            (click)="markComplete.emit()"
            class="text-sm text-gray-500 hover:text-gray-700 border border-gray-300 rounded-md px-3 py-1.5 hover:bg-gray-50 transition-colors"
          >
            Mark complete
          </button>
        </div>
      </div>
    </section>
  `,
})
export class TutorialSectionComponent {
  @Input({ required: true }) step!: number;
  @Input({ required: true }) title!: string;
  @Input() completed: boolean = false;
  @Input() playgroundClassName: string = 'border border-gray-200 rounded-lg p-6 bg-gray-50';
  @Output() markComplete = new EventEmitter<void>();
}
