export interface Primitive {
  id: string;
  name: string;
  ghostHtml: string;
  previewCss: string;
}

export interface ElementsTabProps {
  insertMode?: 'replace' | 'place';
  onArmedChange?: (armed: boolean) => void;
}
