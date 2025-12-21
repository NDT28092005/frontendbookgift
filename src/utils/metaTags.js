/**
 * Utility functions for managing Open Graph and SEO meta tags
 */

/**
 * Set or update Open Graph meta tag
 * @param {string} property - The property name (e.g., 'og:title')
 * @param {string} content - The content value
 */
export const setMetaTag = (property, content) => {
  if (!content) return;

  let meta = document.querySelector(`meta[property="${property}"]`) || 
             document.querySelector(`meta[name="${property}"]`);
  
  if (!meta) {
    meta = document.createElement('meta');
    if (property.startsWith('og:') || property.startsWith('twitter:')) {
      meta.setAttribute('property', property);
    } else {
      meta.setAttribute('name', property);
    }
    document.getElementsByTagName('head')[0].appendChild(meta);
  }
  
  meta.setAttribute('content', content);
};

/**
 * Remove a meta tag
 * @param {string} property - The property name
 */
export const removeMetaTag = (property) => {
  const meta = document.querySelector(`meta[property="${property}"]`) || 
               document.querySelector(`meta[name="${property}"]`);
  if (meta) {
    meta.remove();
  }
};

/**
 * Set Open Graph tags for product sharing
 * @param {Object} product - Product object with name, price, images, description
 * @param {string} currentUrl - Current page URL
 */
export const setProductMetaTags = (product, currentUrl = window.location.href) => {
  if (!product) return;

  const siteName = 'Bloom & Box';
  const title = `${product.name} - ${siteName}`;
  const description = product.short_description || 
                      product.full_description || 
                      `Khám phá ${product.name} - món quà tặng ý nghĩa và chất lượng cao.`;
  
  // Get product image - use first image or placeholder
  let imageUrl = '';
  if (product.images && product.images.length > 0) {
    imageUrl = product.images[0].image_url || product.images[0];
  } else if (product.image_url) {
    imageUrl = product.image_url;
  }
  
  // Ensure image URL is absolute
  if (imageUrl && !imageUrl.startsWith('http')) {
    // If relative URL, make it absolute based on API base URL
    const apiBase = 'https://bebookgift-hugmbshcgaa0b4d6.eastasia-01.azurewebsites.net';
    imageUrl = imageUrl.startsWith('/') ? `${apiBase}${imageUrl}` : `${apiBase}/${imageUrl}`;
  }
  
  // Basic meta tags
  document.title = title;
  setMetaTag('description', description);

  // Open Graph tags
  setMetaTag('og:type', 'product');
  setMetaTag('og:title', title);
  setMetaTag('og:description', description);
  setMetaTag('og:url', currentUrl);
  setMetaTag('og:site_name', siteName);
  
  if (imageUrl) {
    setMetaTag('og:image', imageUrl);
    setMetaTag('og:image:width', '1200');
    setMetaTag('og:image:height', '630');
    setMetaTag('og:image:alt', product.name);
  }

  // Product-specific Open Graph tags
  if (product.price) {
    setMetaTag('product:price:amount', product.price);
    setMetaTag('product:price:currency', 'VND');
  }

  // Twitter Card tags (for better compatibility)
  setMetaTag('twitter:card', 'summary_large_image');
  setMetaTag('twitter:title', title);
  setMetaTag('twitter:description', description);
  if (imageUrl) {
    setMetaTag('twitter:image', imageUrl);
  }
};

/**
 * Set default meta tags for homepage
 */
export const setDefaultMetaTags = () => {
  const siteName = 'Bloom & Box';
  const title = `${siteName} - Cửa hàng quà tặng chuyên nghiệp`;
  const description = 'Cửa hàng quà tặng chuyên nghiệp với hàng ngàn sản phẩm đa dạng. Tìm món quà hoàn hảo cho mọi dịp đặc biệt.';
  const currentUrl = window.location.origin;
  const defaultImage = `${currentUrl}/newlogo.png`;

  document.title = title;
  setMetaTag('description', description);

  setMetaTag('og:type', 'website');
  setMetaTag('og:title', title);
  setMetaTag('og:description', description);
  setMetaTag('og:url', currentUrl);
  setMetaTag('og:site_name', siteName);
  setMetaTag('og:image', defaultImage);

  setMetaTag('twitter:card', 'summary_large_image');
  setMetaTag('twitter:title', title);
  setMetaTag('twitter:description', description);
  setMetaTag('twitter:image', defaultImage);
};

/**
 * Clear product-specific meta tags
 */
export const clearProductMetaTags = () => {
  const tagsToRemove = [
    'og:type',
    'product:price:amount',
    'product:price:currency'
  ];
  
  tagsToRemove.forEach(tag => removeMetaTag(tag));
};

