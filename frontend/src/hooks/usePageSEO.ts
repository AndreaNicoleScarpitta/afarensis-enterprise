import { useEffect } from 'react';

interface PageSEOConfig {
  title: string;
  description: string;
  canonicalPath: string;
  keywords?: string;
  ogTitle?: string;
  ogDescription?: string;
  noindex?: boolean;
}

const SITE_NAME = 'Synthetic Ascension';
const BASE_URL = 'https://syntheticascendancy.tech';

function setMeta(nameOrProperty: string, content: string, isProperty = false) {
  const attr = isProperty ? 'property' : 'name';
  let el = document.querySelector(`meta[${attr}="${nameOrProperty}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, nameOrProperty);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function setCanonical(url: string) {
  let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement('link');
    link.setAttribute('rel', 'canonical');
    document.head.appendChild(link);
  }
  link.setAttribute('href', url);
}

export function usePageSEO(config: PageSEOConfig) {
  useEffect(() => {
    const prevTitle = document.title;

    document.title = `${config.title} | ${SITE_NAME}`;

    setMeta('description', config.description);

    if (config.keywords) {
      setMeta('keywords', config.keywords);
    }

    if (config.noindex) {
      setMeta('robots', 'noindex, nofollow');
    } else {
      setMeta('robots', 'index, follow');
    }

    // Open Graph
    setMeta('og:title', config.ogTitle || config.title, true);
    setMeta('og:description', config.ogDescription || config.description, true);
    setMeta('og:type', 'website', true);
    setMeta('og:url', `${BASE_URL}${config.canonicalPath}`, true);
    setMeta('og:site_name', SITE_NAME, true);

    // Twitter Card
    setMeta('twitter:card', 'summary_large_image');
    setMeta('twitter:title', config.ogTitle || config.title);
    setMeta('twitter:description', config.ogDescription || config.description);

    // Canonical
    setCanonical(`${BASE_URL}${config.canonicalPath}`);

    return () => {
      document.title = prevTitle || 'SA Validate \u2014 Claim Validation Workspace';
    };
  }, [config.title, config.description, config.canonicalPath, config.keywords, config.ogTitle, config.ogDescription, config.noindex]);
}
