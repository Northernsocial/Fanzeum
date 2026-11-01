import { useEffect } from 'react';

interface DocumentMetaOptions {
  title: string;
  description?: string;
  image?: string;
}

const DEFAULT_TITLE = 'Fanzeum — Your Collection, Lit Properly';
const DEFAULT_DESC =
  'Curate, exhibit, identify by photo, and value your football cards, coins, stamps, comics, vinyl, and toys in £ GBP.';

function setMetaTag(selector: string, attrName: 'name' | 'property', attrValue: string, content: string) {
  let tag = document.head.querySelector<HTMLMetaElement>(selector);
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute(attrName, attrValue);
    document.head.appendChild(tag);
  }
  tag.setAttribute('content', content);
}

export function useDocumentMeta({ title, description, image }: DocumentMetaOptions) {
  useEffect(() => {
    const fullTitle = title ? `${title} · Fanzeum` : DEFAULT_TITLE;
    const desc = description?.trim() || DEFAULT_DESC;

    document.title = fullTitle;
    setMetaTag('meta[name="description"]', 'name', 'description', desc);
    setMetaTag('meta[property="og:title"]', 'property', 'og:title', fullTitle);
    setMetaTag('meta[property="og:description"]', 'property', 'og:description', desc);

    if (image && !image.startsWith('data:')) {
      setMetaTag('meta[property="og:image"]', 'property', 'og:image', image);
    }

    return () => {
      document.title = DEFAULT_TITLE;
      setMetaTag('meta[name="description"]', 'name', 'description', DEFAULT_DESC);
      setMetaTag('meta[property="og:title"]', 'property', 'og:title', DEFAULT_TITLE);
      setMetaTag('meta[property="og:description"]', 'property', 'og:description', DEFAULT_DESC);
    };
  }, [title, description, image]);
}
