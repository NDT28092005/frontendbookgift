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
 * @param {Array} reviews - Array of product reviews (optional)
 */
export const setProductMetaTags = (product, currentUrl = window.location.href, reviews = []) => {
  if (!product) return;

  const siteName = 'Bloom & Box';
  
  // Calculate rating and review count
  let averageRating = 0;
  let reviewCount = 0;
  if (reviews && reviews.length > 0) {
    const validReviews = reviews.filter(r => r && !r.is_blocked);
    reviewCount = validReviews.length;
    if (reviewCount > 0) {
      const sum = validReviews.reduce((acc, review) => acc + (review.rating || 0), 0);
      averageRating = (sum / reviewCount).toFixed(1);
    }
  }
  
  // Format price
  const price = product.price ? Number(product.price) : 0;
  const formattedPrice = price > 0 ? new Intl.NumberFormat('vi-VN').format(price) : '';
  const priceText = formattedPrice ? `₫${formattedPrice}` : '';
  
  // Build rich description like Shopee
  let description = '';
  if (product.short_description) {
    description = product.short_description;
  } else if (product.full_description) {
    // Take first 150 characters of full description
    description = product.full_description.substring(0, 150).trim();
    if (product.full_description.length > 150) {
      description += '...';
    }
  } else {
    description = `Khám phá ${product.name} - món quà tặng ý nghĩa và chất lượng cao.`;
  }
  
  // Add price and rating to description for better display
  const descriptionParts = [description];
  if (priceText) {
    descriptionParts.push(`Giá: ${priceText}`);
  }
  if (averageRating > 0 && reviewCount > 0) {
    const stars = '⭐'.repeat(Math.round(averageRating));
    descriptionParts.push(`${stars} ${averageRating}/5 (${reviewCount} đánh giá)`);
  }
  
  const richDescription = descriptionParts.join(' | ');
  
  const title = `${product.name}${priceText ? ` - ${priceText}` : ''} - ${siteName}`;
  
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
  setMetaTag('description', richDescription);

  // Open Graph tags
  setMetaTag('og:type', 'product');
  setMetaTag('og:title', title);
  setMetaTag('og:description', richDescription);
  setMetaTag('og:url', currentUrl);
  setMetaTag('og:site_name', siteName);
  setMetaTag('og:locale', 'vi_VN');
  
  if (imageUrl) {
    setMetaTag('og:image', imageUrl);
    setMetaTag('og:image:width', '1200');
    setMetaTag('og:image:height', '1200');
    setMetaTag('og:image:alt', product.name);
    setMetaTag('og:image:type', 'image/jpeg');
  }

  // Product-specific Open Graph tags
  if (product.price) {
    setMetaTag('product:price:amount', product.price);
    setMetaTag('product:price:currency', 'VND');
  }
  
  // Add availability
  if (product.stock_quantity !== undefined) {
    const availability = product.stock_quantity > 0 ? 'in stock' : 'out of stock';
    setMetaTag('product:availability', availability);
  }

  // Twitter Card tags (for better compatibility)
  setMetaTag('twitter:card', 'summary_large_image');
  setMetaTag('twitter:title', title);
  setMetaTag('twitter:description', richDescription);
  if (imageUrl) {
    setMetaTag('twitter:image', imageUrl);
  }
  
  // Add structured data (JSON-LD) for better SEO and social sharing
  addProductStructuredData(product, reviews, currentUrl, imageUrl, averageRating, reviewCount);
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
 * Add structured data (JSON-LD) for product
 * This helps Facebook, Google, and other platforms understand the product better
 */
const addProductStructuredData = (product, reviews, currentUrl, imageUrl, averageRating, reviewCount) => {
  // Remove existing product structured data
  const existingScript = document.querySelector('script[type="application/ld+json"][data-product-schema]');
  if (existingScript) {
    existingScript.remove();
  }
  
  // Calculate aggregate rating
  let aggregateRating = null;
  if (averageRating > 0 && reviewCount > 0) {
    aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: averageRating,
      reviewCount: reviewCount,
      bestRating: '5',
      worstRating: '1'
    };
  }
  
  // Build offers
  const offers = {
    '@type': 'Offer',
    price: product.price || 0,
    priceCurrency: 'VND',
    availability: product.stock_quantity > 0 
      ? 'https://schema.org/InStock' 
      : 'https://schema.org/OutOfStock',
    url: currentUrl
  };
  
  // Build product schema
  const productSchema = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.short_description || product.full_description || '',
    image: imageUrl ? [imageUrl] : [],
    sku: product.id?.toString() || '',
    brand: {
      '@type': 'Brand',
      name: 'Bloom & Box'
    },
    offers: offers
  };
  
  // Add aggregate rating if available
  if (aggregateRating) {
    productSchema.aggregateRating = aggregateRating;
  }
  
  // Add category if available
  if (product.category) {
    productSchema.category = product.category.name || '';
  }
  
  // Create and append script tag
  const script = document.createElement('script');
  script.type = 'application/ld+json';
  script.setAttribute('data-product-schema', 'true');
  script.textContent = JSON.stringify(productSchema);
  document.getElementsByTagName('head')[0].appendChild(script);
};

/**
 * Clear product-specific meta tags and structured data
 */
export const clearProductMetaTags = () => {
  const tagsToRemove = [
    'og:type',
    'product:price:amount',
    'product:price:currency',
    'product:availability'
  ];
  
  tagsToRemove.forEach(tag => removeMetaTag(tag));
  
  // Remove structured data
  const existingScript = document.querySelector('script[type="application/ld+json"][data-product-schema]');
  if (existingScript) {
    existingScript.remove();
  }
};

