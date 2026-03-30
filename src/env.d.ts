/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

interface Window {
  $(selector: string): any;
  toastr: any;
  characters: any[];
  this_chid: number | string;
  main_api: string;
}
