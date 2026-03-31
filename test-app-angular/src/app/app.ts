import { Component } from '@angular/core';
import { BadgeComponent } from './components/badge.component';
import { ButtonComponent } from './components/button.component';
import { CardComponent } from './components/card.component';
import { TagComponent } from './components/tag.component';
import { CaseListComponent } from './case-list.component';

@Component({
  selector: 'app-root',
  imports: [BadgeComponent, ButtonComponent, CardComponent, TagComponent, CaseListComponent],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {}
