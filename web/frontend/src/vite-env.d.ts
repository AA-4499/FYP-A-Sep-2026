/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_HCAPTCHA_SITE_KEY?: string;
}

declare namespace JSX {
  interface IntrinsicElements {
    'model-viewer': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
      src?: string;
      alt?: string;
      'camera-controls'?: boolean;
      'auto-rotate'?: boolean;
      'shadow-intensity'?: string | number;
      exposure?: string | number;
      slot?: string;
    };
  }
}
