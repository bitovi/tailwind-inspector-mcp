import { Component } from '@angular/core';
import { NgIf } from '@angular/common';
import { BadgeComponent } from './components/badge.component';
import { ButtonComponent } from './components/button.component';
import { CardComponent } from './components/card.component';
import { InputComponent } from './components/input.component';
import { TutorialSectionComponent } from './components/tutorial-section.component';
import { TutorialProgressService } from './services/tutorial-progress.service';

@Component({
  selector: 'app-root',
  imports: [
    NgIf,
    BadgeComponent,
    ButtonComponent,
    CardComponent,
    InputComponent,
    TutorialSectionComponent,
  ],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  constructor(public progress: TutorialProgressService) {}

  readonly totalSteps = 11;

  get completedCount(): number {
    return this.progress.completedCount;
  }

  triggerInvoiceError(): void {
    console.error('[Billing] Failed to refresh invoice: INVOICE_CALC_ERROR — negative overage value is invalid');
    fetch('/api/billing/invoice/1042/refresh', { method: 'POST' }).catch(() => {});
  }
}
