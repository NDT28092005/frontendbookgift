import React, { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { AuthContext } from '../../../context/AuthContext';
import Header from '../../common/Header';
import Footer from '../../common/Footer';
import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import Card from 'react-bootstrap/Card';
import Button from 'react-bootstrap/Button';
import Badge from 'react-bootstrap/Badge';
import Form from 'react-bootstrap/Form';
import { FaShoppingCart, FaStar, FaArrowLeft, FaUser, FaFacebook, FaFacebookMessenger } from 'react-icons/fa';
import Dropdown from 'react-bootstrap/Dropdown';

// Component hiển thị sao đánh giá
const StarRating = ({ rating, onRatingChange, readonly = false, size = '1.2rem' }) => {
  return (
    <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
      {[1, 2, 3, 4, 5].map((star) => (
        <FaStar
          key={star}
          onClick={() => !readonly && onRatingChange && onRatingChange(star)}
          style={{
            color: star <= rating ? '#FFD700' : '#ddd',
            cursor: readonly ? 'default' : 'pointer',
            fontSize: size,
            transition: 'all 0.2s ease',
            filter: star <= rating ? 'drop-shadow(0 2px 4px rgba(255, 215, 0, 0.3))' : 'none'
          }}
          onMouseEnter={(e) => {
            if (!readonly) {
              e.currentTarget.style.transform = 'scale(1.2)';
            }
          }}
          onMouseLeave={(e) => {
            if (!readonly) {
              e.currentTarget.style.transform = 'scale(1)';
            }
          }}
        />
      ))}
    </div>
  );
};

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { token, user, loading: authLoading } = useContext(AuthContext);
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [reviews, setReviews] = useState([]);
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [relatedProducts, setRelatedProducts] = useState([]);
  const [activeTab, setActiveTab] = useState('reviews'); // 'details', 'reviews', 'faqs'
  const [reviewSort, setReviewSort] = useState('latest');
  const [addingToCart, setAddingToCart] = useState(false);

  // Helper function to set or update meta tag
  const setMetaTag = (property, content) => {
    let meta = document.querySelector(`meta[property="${property}"]`) || 
               document.querySelector(`meta[name="${property}"]`);
    
    if (!meta) {
      meta = document.createElement('meta');
      if (property.startsWith('og:') || property.startsWith('product:')) {
        meta.setAttribute('property', property);
      } else {
        meta.setAttribute('name', property);
      }
      document.getElementsByTagName('head')[0].appendChild(meta);
    }
    
    meta.setAttribute('content', content);
  };

  // Helper function to get absolute image URL
  const getAbsoluteImageUrl = (imageUrl) => {
    if (!imageUrl) return '';
    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
      return imageUrl;
    }
    // If relative URL, prepend API base URL
    if (imageUrl.startsWith('/')) {
      return `https://bebookgift-hugmbshcgaa0b4d6.eastasia-01.azurewebsites.net${imageUrl}`;
    }
    return imageUrl;
  };

  // SEO & Open Graph Meta Tags
  useEffect(() => {
    if (product) {
      const currentUrl = window.location.href;
      const description = product.short_description || product.full_description || `Khám phá ${product.name} - món quà tặng ý nghĩa và chất lượng cao.`;
      
      // Get product image - use first image or placeholder
      const productImage = product.images && product.images.length > 0 
        ? product.images[0].image_url 
        : 'https://via.placeholder.com/1200x630?text=Bloom+%26+Box';
      const absoluteImageUrl = getAbsoluteImageUrl(productImage);
      
      // Basic SEO Meta Tags
      document.title = `${product.name} - Bloom & Box`;
      setMetaTag('description', description);
      
      // Open Graph Meta Tags for Facebook
      setMetaTag('og:type', 'product');
      setMetaTag('og:title', `${product.name} - Bloom & Box`);
      setMetaTag('og:description', description);
      setMetaTag('og:image', absoluteImageUrl);
      setMetaTag('og:image:width', '1200');
      setMetaTag('og:image:height', '630');
      setMetaTag('og:image:alt', product.name);
      setMetaTag('og:url', currentUrl);
      setMetaTag('og:site_name', 'Bloom & Box');
      setMetaTag('og:locale', 'vi_VN');
      
      // Product-specific Open Graph tags
      setMetaTag('product:price:amount', product.price);
      setMetaTag('product:price:currency', 'VND');
      setMetaTag('product:availability', 'in stock');
      
      // Twitter Card Meta Tags (bonus)
      setMetaTag('twitter:card', 'summary_large_image');
      setMetaTag('twitter:title', `${product.name} - Bloom & Box`);
      setMetaTag('twitter:description', description);
      setMetaTag('twitter:image', absoluteImageUrl);
    }
  }, [product]);

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        setLoading(true);
        const response = await axios.get(`https://bebookgift-hugmbshcgaa0b4d6.eastasia-01.azurewebsites.net/api/products/${id}`);
        if (response && response.data) {
          setProduct(response.data);
          // Fetch related products after product is loaded
          fetchRelatedProducts(response.data);
        } else {
          setProduct(null);
        }
        setLoading(false);
      } catch (error) {
        console.error('Fetch product error:', error);
        setProduct(null);
        setLoading(false);
      }
    };

    if (id) {
      fetchProduct();
    }
  }, [id]);

  const fetchRelatedProducts = async (currentProduct) => {
    try {
      // Fetch products from same category or occasion
      const params = {};
      if (currentProduct.category_id) {
        params.category_id = currentProduct.category_id;
      }
      if (currentProduct.occasion_id) {
        params.occasion_id = currentProduct.occasion_id;
      }

      const response = await axios.get('https://bebookgift-hugmbshcgaa0b4d6.eastasia-01.azurewebsites.net/api/products', { params });
      const allProducts = response.data || [];
      
      // Filter out current product and inactive products, then take 4 products
      const related = allProducts
        .filter(p => p.id !== currentProduct.id && p.is_active !== false)
        .slice(0, 4);
      
      setRelatedProducts(related);
    } catch (error) {
      console.error('Fetch related products error:', error);
      setRelatedProducts([]);
    }
  };

  useEffect(() => {
    const fetchReviews = async () => {
      try {
        setReviewsLoading(true);
        const response = await axios.get('https://bebookgift-hugmbshcgaa0b4d6.eastasia-01.azurewebsites.net/api/reviews/');
        // Filter reviews theo product_id và chỉ lấy reviews không bị block
        const allReviews = Array.isArray(response && response.data) ? response.data : [];
        const productReviews = allReviews.filter(
          review => review && review.product_id === parseInt(id) && !review.is_blocked
        );
        setReviews(productReviews);
        setReviewsLoading(false);
      } catch (error) {
        console.error('Fetch reviews error:', error);
        setReviews([]);
        setReviewsLoading(false);
      }
    };

    if (id) {
      fetchReviews();
    }
  }, [id]);

  const addToCart = async () => {
    if (authLoading || addingToCart) {
      return;
    }

    const tokenFromContext = token;
    let tokenFromStorage = localStorage.getItem('token');
    
    if (tokenFromStorage === 'undefined' || tokenFromStorage === 'null') {
      localStorage.removeItem('token');
      tokenFromStorage = null;
    }
    
    const currentToken = tokenFromContext || tokenFromStorage;
    
    if (!currentToken || currentToken === 'undefined' || currentToken === 'null') {
      navigate('/login', { state: { from: location.pathname } });
      return;
    }

    try {
      setAddingToCart(true);
      await axios.post(
        "https://bebookgift-hugmbshcgaa0b4d6.eastasia-01.azurewebsites.net/api/cart/add",
        { product_id: id, quantity: quantity },
        { headers: { Authorization: `Bearer ${currentToken}` } }
      );
      alert("✅ Đã thêm vào giỏ hàng!");
    } catch (err) {
      console.error("Add to cart error:", err);
      const errorMsg = (err.response && err.response.data && err.response.data.message) || err.message || "Lỗi khi thêm vào giỏ hàng";
      alert("❌ " + errorMsg);
    } finally {
      setAddingToCart(false);
    }
  };

  // Facebook Share Functions
  const shareOnFacebook = () => {
    const url = encodeURIComponent(window.location.href);
    const quote = encodeURIComponent(`${product.name} - ${product.short_description || ''}`);
    const shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${url}&quote=${quote}`;
    window.open(shareUrl, '_blank', 'width=600,height=400');
  };

  const shareOnMessenger = () => {
    const url = encodeURIComponent(window.location.href);
    // Use Facebook Send Dialog for sharing via Messenger
    const shareUrl = `https://www.facebook.com/dialog/send?link=${url}&redirect_uri=${encodeURIComponent(window.location.href)}`;
    // For mobile devices, try to use messenger app
    if (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
      // Try to open in Messenger app first, fallback to web
      const messengerUrl = `fb-messenger://share?link=${url}`;
      window.location.href = messengerUrl;
      // Fallback after a short delay if app doesn't open
      setTimeout(() => {
        window.open(shareUrl, '_blank', 'width=600,height=400');
      }, 500);
    } else {
      window.open(shareUrl, '_blank', 'width=600,height=400');
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('vi-VN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const calculateAverageRating = () => {
    if (reviews.length === 0) return 0;
    const sum = reviews.reduce((acc, review) => acc + review.rating, 0);
    return (sum / reviews.length).toFixed(1);
  };

  const submitReview = async () => {
    if (!user || !user.id) {
      navigate('/login', { state: { from: location.pathname } });
      return;
    }

    if (!reviewRating || reviewRating < 1 || reviewRating > 5) {
      alert('Vui lòng chọn số sao đánh giá!');
      return;
    }

    const tokenFromContext = token;
    let tokenFromStorage = localStorage.getItem('token');
    
    if (tokenFromStorage === 'undefined' || tokenFromStorage === 'null') {
      localStorage.removeItem('token');
      tokenFromStorage = null;
    }
    
    const currentToken = tokenFromContext || tokenFromStorage;
    
    if (!currentToken || currentToken === 'undefined' || currentToken === 'null') {
      navigate('/login', { state: { from: location.pathname } });
      return;
    }

    try {
      setSubmittingReview(true);
      await axios.post(
        'https://bebookgift-hugmbshcgaa0b4d6.eastasia-01.azurewebsites.net/api/reviews/',
        {
          product_id: parseInt(id),
          user_id: user.id,
          rating: reviewRating,
          comment: reviewComment || null
        },
        { headers: { Authorization: `Bearer ${currentToken}` } }
      );
      
      // Refresh reviews
      const response = await axios.get('https://bebookgift-hugmbshcgaa0b4d6.eastasia-01.azurewebsites.net/api/reviews/');
      const allReviews = Array.isArray(response && response.data) ? response.data : [];
      const productReviews = allReviews.filter(
        review => review && review.product_id === parseInt(id) && !review.is_blocked
      );
      setReviews(productReviews);
      
      // Reset form
      setReviewRating(5);
      setReviewComment('');
      setShowReviewForm(false);
      alert('✅ Đánh giá của bạn đã được gửi thành công!');
    } catch (err) {
      console.error('Submit review error:', err);
      const errorMsg = (err.response && err.response.data && err.response.data.message) || err.message || "Lỗi khi gửi đánh giá. Vui lòng thử lại!";
      alert('❌ ' + errorMsg);
    } finally {
      setSubmittingReview(false);
    }
  };

  if (loading) {
    return (
      <>
        <Header />
        <main className="product-detail-page">
          <Container style={{ paddingBottom: '80px', minHeight: '70vh' }}>
          <div className="d-flex flex-column justify-content-center align-items-center" style={{ minHeight: '60vh', gap: '20px' }}>
            <div className="loading-spinner" style={{ 
              width: '60px', 
              height: '60px', 
              border: '5px solid rgba(251, 99, 118, 0.2)', 
              borderTopColor: '#FB6376', 
              borderRightColor: '#FCB1A6', 
              borderRadius: '50%', 
              animation: 'spin 1s linear infinite',
              position: 'relative'
            }}>
              <div style={{
                position: 'absolute',
                inset: '-5px',
                border: '5px solid transparent',
                borderTopColor: 'rgba(251, 99, 118, 0.1)',
                borderRadius: '50%',
                animation: 'spin 1.5s linear infinite reverse'
              }}></div>
            </div>
            <p style={{ color: '#5D2A42', fontSize: '1rem', fontWeight: '500', margin: 0 }}>Đang tải sản phẩm...</p>
          </div>
          </Container>
        </main>
        <Footer />
      </>
    );
  }

  if (!product) {
    return (
      <>
        <Header />
        <main className="product-detail-page">
          <Container style={{ paddingBottom: '80px', minHeight: '70vh' }}>
          <Card style={{ padding: '3rem', textAlign: 'center' }}>
            <h2 style={{ color: '#5D2A42' }}>Không tìm thấy sản phẩm</h2>
            <Button onClick={() => navigate('/products')} style={{ marginTop: '1rem' }}>
              <FaArrowLeft style={{ marginRight: '0.5rem' }} />
              Quay lại danh sách
            </Button>
          </Card>
          </Container>
        </main>
        <Footer />
      </>
    );
  }

  const images = product.images && product.images.length > 0 
    ? product.images.map(img => img.image_url) 
    : ['https://via.placeholder.com/600x600?text=No+Image'];

  return (
    <>
      <Header />
      <main className="product-detail-shopee">
        <Container style={{ maxWidth: '1200px', paddingBottom: '80px' }}>
        {/* Breadcrumb */}
        <div className="breadcrumb-nav" style={{ marginBottom: '1rem' }}>
          <span onClick={() => navigate('/products')} style={{ cursor: 'pointer' }}>Trang chủ</span>
          <span style={{ margin: '0 0.5rem' }}>/</span>
          <span onClick={() => navigate('/products')} style={{ cursor: 'pointer' }}>Sản phẩm</span>
          <span style={{ margin: '0 0.5rem' }}>/</span>
          <span style={{ color: 'rgba(0, 0, 0, 0.87)' }}>{product.name}</span>
        </div>

        {/* Main Product Section - Shopee Style */}
        <div className="product-main-section">
          <Row>
            {/* Product Images - Shopee Style Gallery */}
            <Col md={6}>
              <div className="product-image-gallery" style={{ display: 'flex' }}>
                {/* Thumbnail Images - Bên trái */}
                {images.length > 1 && (
                  <div className="image-thumbnails">
                    {images.map((img, idx) => (
                      <div
                        key={idx}
                        className={`thumbnail-item ${selectedImageIndex === idx ? 'active' : ''}`}
                        onClick={() => setSelectedImageIndex(idx)}
                      >
                        <img
                          src={img}
                          alt={`${product.name} ${idx + 1}`}
                        />
                      </div>
                    ))}
                  </div>
                )}
                
                {/* Main Image - Shopee Style */}
                <div className="main-image-container" style={{ flex: 1 }}>
                  <div className="main-image-wrapper">
                    <img
                      src={images[selectedImageIndex] || images[0]}
                      alt={product.name}
                    />
                  </div>
                </div>
              </div>
            </Col>

          {/* Product Info - Shopee Style */}
          <Col md={6}>
            <div className="product-info-shopee">
              <h1 className="product-name">{product.name}</h1>
              
              {/* Rating Section - Shopee Style */}
              <div className="product-rating-section">
                {!reviewsLoading && reviews.length > 0 ? (
                  <>
                    <div className="rating-stars">
                      <StarRating rating={Math.round(calculateAverageRating())} readonly={true} size="0.875rem" />
                      <span className="rating-text">{calculateAverageRating()}</span>
                    </div>
                    <span className="sold-count">
                      ({reviews.length} đánh giá)
                    </span>
                  </>
                ) : (
                  <span style={{ color: 'rgba(0, 0, 0, 0.54)', fontSize: '0.875rem' }}>
                    Chưa có đánh giá
                  </span>
                )}
              </div>

              {/* Short Description Section - Above Price */}
              {product.short_description && (
                <div className="product-short-description" style={{
                  marginBottom: '1rem',
                  padding: '0.75rem',
                  background: 'rgba(0, 0, 0, 0.02)',
                  borderRadius: '4px',
                  fontSize: '0.875rem',
                  color: 'rgba(0, 0, 0, 0.87)',
                  lineHeight: '1.5'
                }}>
                  {product.short_description}
                </div>
              )}

              {/* Price Section - Shopee Style */}
              <div className="product-price-section">
                <div className="current-price">
                  <span className="currency">₫</span>
                  {new Intl.NumberFormat('vi-VN').format(Number(product.price))}
                </div>
                {product.original_price && Number(product.original_price) > Number(product.price) && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span className="original-price">
                      ₫{new Intl.NumberFormat('vi-VN').format(Number(product.original_price))}
                    </span>
                    <span className="discount-badge">
                      -{Math.round(((Number(product.original_price) - Number(product.price)) / Number(product.original_price)) * 100)}%
                    </span>
                  </div>
                )}
              </div>

              {/* Quantity Section - Shopee Style */}
              <div className="quantity-section">
                <span className="quantity-label">Số lượng</span>
                <div className="quantity-controls">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    disabled={quantity <= 1}
                  >
                    −
                  </button>
                  <span className="quantity-value">{quantity}</span>
                  <button onClick={() => setQuantity(quantity + 1)}>+</button>
                </div>
              </div>

              {/* Action Buttons - Shopee Style */}
              <div className="action-buttons">
                <button className="btn-add-cart" onClick={addToCart} disabled={addingToCart}>
                  <FaShoppingCart />
                  {addingToCart ? 'Đang thêm...' : 'Thêm vào giỏ hàng'}
                </button>
                <button className="btn-buy-now" onClick={() => {
                  addToCart();
                  setTimeout(() => navigate('/checkout'), 500);
                }} disabled={addingToCart}>
                  Mua ngay
                </button>
              </div>

              {/* Facebook Share Button */}
              <Dropdown style={{ width: '100%', marginBottom: '1rem' }}>
                <Dropdown.Toggle
                  style={{
                    background: 'linear-gradient(135deg, #1877F2, #42A5F5)',
                    border: 'none',
                    borderRadius: '2px',
                    padding: '0.75rem 1.5rem',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    color: 'white',
                    width: '100%',
                    transition: 'all 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'linear-gradient(135deg, #1565C0, #1976D2)';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.boxShadow = '0 2px 8px rgba(24, 119, 242, 0.3)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'linear-gradient(135deg, #1877F2, #42A5F5)';
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <FaFacebook style={{ fontSize: '1rem' }} />
                  Chia sẻ Facebook
                </Dropdown.Toggle>
                <Dropdown.Menu style={{
                  borderRadius: '4px',
                  border: '1px solid rgba(0, 0, 0, 0.09)',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
                  padding: '0.5rem',
                  minWidth: '200px'
                }}>
                  <Dropdown.Item
                    onClick={shareOnFacebook}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      padding: '0.75rem 1rem',
                      borderRadius: '4px',
                      color: 'rgba(0, 0, 0, 0.87)',
                      fontSize: '0.875rem',
                      transition: 'all 0.2s',
                      cursor: 'pointer'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(24, 119, 242, 0.1)';
                      e.currentTarget.style.color = '#1877F2';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.color = 'rgba(0, 0, 0, 0.87)';
                    }}
                  >
                    <FaFacebook style={{ fontSize: '1rem', color: '#1877F2' }} />
                    <span style={{ fontWeight: 500 }}>Chia sẻ lên News Feed</span>
                  </Dropdown.Item>
                  <Dropdown.Item
                    onClick={shareOnMessenger}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      padding: '0.75rem 1rem',
                      borderRadius: '4px',
                      color: 'rgba(0, 0, 0, 0.87)',
                      fontSize: '0.875rem',
                      transition: 'all 0.2s',
                      cursor: 'pointer'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(0, 132, 255, 0.1)';
                      e.currentTarget.style.color = '#0084FF';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.color = 'rgba(0, 0, 0, 0.87)';
                    }}
                  >
                    <FaFacebookMessenger style={{ fontSize: '1rem', color: '#0084FF' }} />
                    <span style={{ fontWeight: 500 }}>Chia sẻ qua Messenger</span>
                  </Dropdown.Item>
                </Dropdown.Menu>
              </Dropdown>

              {/* Product Features */}
              <div className="product-features">
                <div className="feature-item">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M8 0L10.163 5.607L16 6.236L12 10.236L12.944 16L8 13.236L3.056 16L4 10.236L0 6.236L5.837 5.607L8 0Z"/>
                  </svg>
                  <span>COD toàn quốc</span>
                </div>
                <div className="feature-item">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M8 0L10.163 5.607L16 6.236L12 10.236L12.944 16L8 13.236L3.056 16L4 10.236L0 6.236L5.837 5.607L8 0Z"/>
                  </svg>
                  <span>Giao hàng toàn quốc đơn hàng từ 139k</span>
                </div>
                <div className="feature-item">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M8 0L10.163 5.607L16 6.236L12 10.236L12.944 16L8 13.236L3.056 16L4 10.236L0 6.236L5.837 5.607L8 0Z"/>
                  </svg>
                  <span>Đổi trả trong 24h</span>
                </div>
              </div>
            </div>
          </Col>
        </Row>

        </div>

        {/* Product Information Tabs - Shopee Style */}
        <div className="product-tabs-section">
          {/* Tabs Navigation - Shopee Style */}
          <div className="tabs-header">
            {[
              { id: 'details', label: 'Mô tả sản phẩm' },
              { id: 'reviews', label: 'Đánh giá' },
              { id: 'faqs', label: 'Câu hỏi thường gặp' }
            ].map((tab) => (
              <button
                key={tab.id}
                className={`tab-item ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content - Shopee Style */}
          <div className="tabs-content">
            {activeTab === 'details' && (
              <div className="product-description">
                {product.full_description ? (
                  <div style={{ whiteSpace: 'pre-line' }}>
                    {product.full_description}
                  </div>
                ) : (
                  <p style={{ color: 'rgba(0, 0, 0, 0.54)' }}>
                    Không có thông tin chi tiết về sản phẩm này.
                  </p>
                )}
              </div>
            )}

            {activeTab === 'reviews' && (
              <div className="reviews-section">
                {/* Reviews Header - Shopee Style */}
                <div className="reviews-header">
                  <div className="reviews-title">
                    Đánh giá sản phẩm ({reviews.length})
                  </div>
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    <Form.Select
                      value={reviewSort}
                      onChange={(e) => setReviewSort(e.target.value)}
                      style={{
                        borderRadius: '2px',
                        border: '1px solid rgba(0, 0, 0, 0.09)',
                        padding: '0.5rem 1rem',
                        color: 'rgba(0, 0, 0, 0.87)',
                        fontSize: '0.875rem',
                        background: '#fff',
                        cursor: 'pointer',
                        minWidth: '150px'
                      }}
                    >
                      <option value="latest">Mới nhất</option>
                      <option value="oldest">Cũ nhất</option>
                      <option value="highest">Đánh giá cao nhất</option>
                      <option value="lowest">Đánh giá thấp nhất</option>
                    </Form.Select>
                    {user && (
                      <Button
                        onClick={() => setShowReviewForm(!showReviewForm)}
                        style={{
                          background: showReviewForm ? 'rgba(0, 0, 0, 0.54)' : '#FB6376',
                          border: 'none',
                          borderRadius: '2px',
                          padding: '0.5rem 1rem',
                          fontSize: '0.875rem',
                          fontWeight: 500,
                          color: 'white',
                          whiteSpace: 'nowrap',
                          transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => {
                          if (!showReviewForm) {
                            e.currentTarget.style.background = '#FCB1A6';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!showReviewForm) {
                            e.currentTarget.style.background = '#FB6376';
                          }
                        }}
                      >
                        {showReviewForm ? 'Hủy' : 'Viết đánh giá'}
                      </Button>
                    )}
                  </div>
                </div>

                {/* Review Form - Shopee Style */}
                {showReviewForm && user && (
                  <div style={{
                    border: '1px solid rgba(0, 0, 0, 0.09)',
                    borderRadius: '4px',
                    padding: '1.5rem',
                    marginBottom: '1.5rem',
                    background: '#fff'
                  }}>
                    <h4 style={{
                      fontSize: '1rem',
                      fontWeight: 500,
                      color: 'rgba(0, 0, 0, 0.87)',
                      marginBottom: '1rem'
                    }}>
                      Đánh giá của bạn
                    </h4>
                    <div style={{ marginBottom: '1rem' }}>
                      <label style={{
                        fontSize: '0.875rem',
                        color: 'rgba(0, 0, 0, 0.87)',
                        fontWeight: 500,
                        marginBottom: '0.5rem',
                        display: 'block'
                      }}>
                        Số sao đánh giá <span style={{ color: '#FB6376' }}>*</span>
                      </label>
                      <StarRating 
                        rating={reviewRating} 
                        onRatingChange={setReviewRating}
                        readonly={false}
                        size="1.25rem"
                      />
                    </div>
                    <div style={{ marginBottom: '1.5rem' }}>
                      <Form.Label style={{
                        fontSize: '0.875rem',
                        color: 'rgba(0, 0, 0, 0.87)',
                        fontWeight: 500,
                        marginBottom: '0.5rem',
                        display: 'block'
                      }}>
                        Nhận xét của bạn
                      </Form.Label>
                      <Form.Control
                        as="textarea"
                        rows={4}
                        value={reviewComment}
                        onChange={(e) => setReviewComment(e.target.value)}
                        placeholder="Chia sẻ trải nghiệm của bạn về sản phẩm này..."
                        style={{
                          borderRadius: '2px',
                          border: '1px solid rgba(0, 0, 0, 0.09)',
                          padding: '0.75rem',
                          fontSize: '0.875rem',
                          color: 'rgba(0, 0, 0, 0.87)',
                          resize: 'vertical',
                          fontFamily: 'inherit'
                        }}
                      />
                    </div>
                    <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                      <Button
                        variant="outline-secondary"
                        onClick={() => {
                          setShowReviewForm(false);
                          setReviewRating(5);
                          setReviewComment('');
                        }}
                        style={{
                          borderRadius: '2px',
                          padding: '0.5rem 1.5rem',
                          borderColor: 'rgba(0, 0, 0, 0.09)',
                          color: 'rgba(0, 0, 0, 0.87)',
                          fontSize: '0.875rem',
                          fontWeight: 500,
                          background: '#fff'
                        }}
                      >
                        Hủy
                      </Button>
                      <Button
                        onClick={submitReview}
                        disabled={submittingReview}
                        style={{
                          background: '#FB6376',
                          border: 'none',
                          borderRadius: '2px',
                          padding: '0.5rem 1.5rem',
                          fontSize: '0.875rem',
                          fontWeight: 500,
                          color: 'white'
                        }}
                        onMouseEnter={(e) => {
                          if (!submittingReview) {
                            e.currentTarget.style.background = '#FCB1A6';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!submittingReview) {
                            e.currentTarget.style.background = '#FB6376';
                          }
                        }}
                      >
                        {submittingReview ? 'Đang gửi...' : 'Gửi đánh giá'}
                      </Button>
                    </div>
                  </div>
                )}

                {!user && !showReviewForm && (
                  <div style={{
                    padding: '1.5rem',
                    background: 'rgba(251, 99, 118, 0.05)',
                    borderRadius: '4px',
                    marginBottom: '1.5rem',
                    textAlign: 'center',
                    border: '1px solid rgba(251, 99, 118, 0.2)'
                  }}>
                    <p style={{ 
                      fontSize: '0.875rem',
                      color: 'rgba(0, 0, 0, 0.87)', 
                      margin: 0, 
                      marginBottom: '1rem' 
                    }}>
                      Đăng nhập để viết đánh giá về sản phẩm này
                    </p>
                    <Button
                      onClick={() => navigate('/login', { state: { from: location.pathname } })}
                      style={{
                        background: '#FB6376',
                        border: 'none',
                        borderRadius: '2px',
                        padding: '0.5rem 1.5rem',
                        fontSize: '0.875rem',
                        fontWeight: 500,
                        color: 'white'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#FCB1A6';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = '#FB6376';
                      }}
                    >
                      Đăng nhập
                    </Button>
                  </div>
                )}

                {/* Reviews List - Shopee Style */}
                {reviewsLoading ? (
                  <div style={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    padding: '3rem'
                  }}>
                    <div className="loading-spinner" style={{ 
                      width: '40px', 
                      height: '40px', 
                      border: '4px solid rgba(251, 99, 118, 0.2)', 
                      borderTopColor: '#FB6376', 
                      borderRadius: '50%', 
                      animation: 'spin 1s linear infinite'
                    }}></div>
                  </div>
                ) : reviews.length === 0 ? (
                  <div style={{
                    padding: '3rem',
                    textAlign: 'center',
                    color: 'rgba(0, 0, 0, 0.54)'
                  }}>
                    <FaStar style={{ fontSize: '3rem', marginBottom: '1rem', opacity: 0.3, color: '#FB6376' }} />
                    <p style={{ fontSize: '0.875rem', margin: 0 }}>
                      Chưa có đánh giá nào cho sản phẩm này. Hãy là người đầu tiên đánh giá!
                    </p>
                  </div>
                ) : (
                  <div>
                    {reviews.map((review) => (
                      <div key={review.review_id} className="review-card">
                        <div className="review-header">
                          <div className="reviewer-avatar">
                            <FaUser />
                          </div>
                          <div className="reviewer-info">
                            <div className="reviewer-name">
                              {(review.user && review.user.name) || 'Người dùng'}
                            </div>
                            <div className="review-date">
                              {formatDate(review.created_at)}
                            </div>
                          </div>
                          <div className="review-rating">
                            <StarRating rating={review.rating} readonly={true} size="0.875rem" />
                          </div>
                        </div>
                        {review.comment && (
                          <div className="review-comment">
                            {review.comment}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'faqs' && (
              <div>
                <h3 style={{
                  fontSize: '1.125rem',
                  fontWeight: 500,
                  color: 'rgba(0, 0, 0, 0.87)',
                  marginBottom: '1.5rem'
                }}>
                  Câu hỏi thường gặp
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {[
                    {
                      question: 'Làm thế nào để đặt hàng?',
                      answer: 'Bạn có thể thêm sản phẩm vào giỏ hàng và tiến hành thanh toán. Chúng tôi hỗ trợ nhiều phương thức thanh toán khác nhau, bao gồm COD (thanh toán khi nhận hàng) toàn quốc.'
                    },
                    {
                      question: 'Chính sách giao hàng như thế nào?',
                      answer: 'Chúng tôi giao hàng toàn quốc cho đơn hàng từ 139.000đ sẽ tính phí vận chuyển theo bảng giá của đơn vị vận chuyển.'
                    },
                    {
                      question: 'Có thể đổi trả sản phẩm không?',
                      answer: 'Có, chúng tôi hỗ trợ đổi trả trong vòng 24 giờ kể từ ngày nhận hàng với điều kiện sản phẩm còn nguyên vẹn, chưa sử dụng và còn đầy đủ tem nhãn, bao bì.'
                    }
                  ].map((faq, index) => (
                    <div
                      key={index}
                      style={{
                        border: '1px solid rgba(0, 0, 0, 0.09)',
                        borderRadius: '4px',
                        padding: '1rem',
                        background: '#fff',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.1)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    >
                      <div style={{
                        fontWeight: 500,
                        fontSize: '0.875rem',
                        color: 'rgba(0, 0, 0, 0.87)',
                        marginBottom: '0.5rem'
                      }}>
                        {faq.question}
                      </div>
                      <div style={{
                        fontSize: '0.875rem',
                        color: 'rgba(0, 0, 0, 0.54)',
                        lineHeight: '1.6'
                      }}>
                        {faq.answer}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Related Products - Shopee Style */}
        {relatedProducts.length > 0 && (
          <div className="related-products-section">
            <h3 className="section-title">Sản phẩm tương tự</h3>
            <div className="related-products-grid">
              {relatedProducts.map((relatedProduct) => (
                <div
                  key={relatedProduct.id}
                  className="product-card"
                  onClick={() => navigate(`/products/${relatedProduct.id}`)}
                >
                  <div className="product-image">
                    <img
                      src={relatedProduct.images?.[0]?.image_url || 'https://via.placeholder.com/300x300?text=No+Image'}
                      alt={relatedProduct.name}
                      onError={(e) => {
                        e.target.src = 'https://via.placeholder.com/300x300?text=No+Image';
                      }}
                    />
                  </div>
                  <div className="product-info">
                    <div className="product-name">{relatedProduct.name}</div>
                    <div className="product-price" style={{ color: '#FB6376' }}>
                      ₫{new Intl.NumberFormat('vi-VN').format(Number(relatedProduct.price))}
                    </div>
                    {relatedProduct.original_price && Number(relatedProduct.original_price) > Number(relatedProduct.price) && (
                      <div style={{
                        fontSize: '0.75rem',
                        color: 'rgba(0, 0, 0, 0.54)',
                        textDecoration: 'line-through',
                        marginTop: '0.25rem'
                      }}>
                        ₫{new Intl.NumberFormat('vi-VN').format(Number(relatedProduct.original_price))}
                      </div>
                    )}
                    <div className="product-rating">
                      <StarRating rating={5} readonly={true} size="0.75rem" />
                      <span style={{ marginLeft: '0.25rem' }}>(0)</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        </Container>
      </main>
      <Footer />
    </>
  );
}

