import { Component } from '@angular/core';

const CASES = [
  { id: 1, title: 'Vehicle Accident Report', code: '#CAS-001' },
  { id: 2, title: 'Insurance Claim Dispute', code: '#CAS-002' },
  { id: 3, title: 'Policy Coverage Inquiry', code: '#CAS-003' },
  { id: 4, title: 'Premium Adjustment Request', code: '#CAS-004' },
  { id: 5, title: 'Billing Discrepancy', code: '#CAS-005' },
];

@Component({
  selector: 'app-case-list',
  template: `
    <div class="flex flex-col gap-2">
      @for (c of cases; track c.id) {
        <a
          href="#"
          [class]="'flex items-center justify-between px-4 py-4 rounded-lg transition-colors ' +
            (c.id === activeId ? 'bg-teal-50 border border-teal-300' : 'hover:bg-gray-100 border border-transparent')"
        >
          <div class="flex flex-col items-start text-sm leading-snug">
            <p class="font-semibold text-teal-700 truncate">{{ c.title }}</p>
            <p class="font-normal text-gray-600 truncate">{{ c.code }}</p>
          </div>
          <div class="flex items-center gap-2 ml-3 shrink-0">
            <span class="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">open</span>
            <svg class="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </a>
      }
    </div>
  `,
})
export class CaseListComponent {
  protected readonly cases = CASES;
  protected readonly activeId = 2;
}
