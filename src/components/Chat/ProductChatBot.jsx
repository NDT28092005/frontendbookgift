import React, { useState, useEffect, useRef, useContext, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { FaStar } from "react-icons/fa";
import { getCategories } from "../../api/category";
import { getProducts } from "../../api/product";
import { getWrappingPapers, getDecorativeAccessories, getCardTypes } from "../../api/gift";
import { detectCategory, createBotResponse, detectBudget, searchProductsByName, filterProductsByBudget } from "../../services/productChatbotService";
import { getOccasions } from "../../api/occasion";
import { AuthContext } from "../../context/AuthContext";
import { startProductChat, saveProductChatMessage, clearProductChatHistory } from "../../api/productChatbot";
import "./ProductChatBot.css";

// Component hiển thị sao đánh giá đơn giản cho chatbot
const StarRating = ({ rating, size = '11px' }) => {
  return (
    <div style={{ display: 'inline-flex', gap: '2px', alignItems: 'center' }}>
      {[1, 2, 3, 4, 5].map((star) => (
        <FaStar
          key={star}
          style={{
            color: star <= Math.round(rating) ? '#FFD700' : '#ddd',
            fontSize: size,
          }}
        />
      ))}
    </div>
  );
};

export default function ProductChatBot({ onClose }) {
  const { token, user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState("");
  const [categories, setCategories] = useState([]);
  const [occasions, setOccasions] = useState([]);
  const [allProducts, setAllProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [_showQuickReplies, setShowQuickReplies] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [giftOptions, setGiftOptions] = useState({
    wrappingPapers: [],
    decorativeAccessories: [],
    cardTypes: []
  });
  const [addingToCart, setAddingToCart] = useState({});
  const [reviewsMap, setReviewsMap] = useState({}); // Map product_id -> reviews array
  const [conversationState, setConversationState] = useState(null); // null, 'asking_recipient', 'asking_gender', 'asking_age'
  const [recipientInfo, setRecipientInfo] = useState({ gender: null, age: null });
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const blurTimeoutRef = useRef(null);

  // Lưu tin nhắn vào backend
  const saveMessageToBackend = useCallback(async (messageData) => {
    if (!token || !user || !conversationId) {
      return null; // Không lưu nếu chưa đăng nhập
    }

    try {
      const response = await saveProductChatMessage({
        conversation_id: conversationId,
        content: messageData.content,
        type: messageData.type,
        products: messageData.products || null,
        showCategories: messageData.showCategories || false,
        categoryId: messageData.categoryId || null,
        categoryName: messageData.categoryName || null,
      });
      return response.data;
    } catch (error) {
      console.error("Error saving message:", error);
      return null;
    }
  }, [token, user, conversationId]);

  // Load upcoming anniversaries cho user (phải định nghĩa trước loadConversationHistory)
  const loadUpcomingAnniversaries = useCallback(async () => {
    if (!token || !user) return;
    
    try {
      const response = await axios.get(
        `https://bebookgift-hugmbshcgaa0b4d6.eastasia-01.azurewebsites.net/api/users/${user.id}/anniversaries`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const anniversaries = response.data || [];
      
      // Lọc các anniversary sắp tới (trong vòng 30 ngày)
      const today = new Date();
      const upcoming = anniversaries.filter(ann => {
        const eventDate = new Date(ann.event_date);
        eventDate.setFullYear(today.getFullYear()); // So sánh trong năm hiện tại
        if (eventDate < today) {
          eventDate.setFullYear(today.getFullYear() + 1); // Nếu đã qua thì tính năm sau
        }
        const diffDays = Math.ceil((eventDate - today) / (1000 * 60 * 60 * 24));
        return diffDays >= 0 && diffDays <= 30;
      }).sort((a, b) => {
        const dateA = new Date(a.event_date);
        const dateB = new Date(b.event_date);
        dateA.setFullYear(today.getFullYear());
        dateB.setFullYear(today.getFullYear());
        if (dateA < today) dateA.setFullYear(today.getFullYear() + 1);
        if (dateB < today) dateB.setFullYear(today.getFullYear() + 1);
        return dateA - dateB;
      });
      
      // Hiển thị gợi ý nếu có anniversary sắp tới và chưa có tin nhắn nào (trừ welcome)
      if (upcoming.length > 0) {
        const nextAnniversary = upcoming[0];
        const eventDate = new Date(nextAnniversary.event_date);
        eventDate.setFullYear(today.getFullYear());
        if (eventDate < today) {
          eventDate.setFullYear(today.getFullYear() + 1);
        }
        const diffDays = Math.ceil((eventDate - today) / (1000 * 60 * 60 * 24));
        
        // Chỉ thêm reminder nếu chưa có trong messages
        setMessages(prev => {
          const hasReminder = prev.some(msg => msg.showAnniversaryReminder);
          if (hasReminder) return prev;
          
          const reminderMessage = {
            id: `reminder-${Date.now()}`,
            type: "bot",
            content: `📅 Nhắc nhở: Sắp đến dịp "${nextAnniversary.event_name}" của bạn (còn ${diffDays} ngày nữa). Bạn có muốn tôi gợi ý quà tặng phù hợp không?`,
            timestamp: new Date(),
            showAnniversaryReminder: true,
            anniversary: nextAnniversary
          };
          return [...prev, reminderMessage];
        });
      }
    } catch (error) {
      console.error("Error loading anniversaries:", error);
    }
  }, [token, user]);

  // Load lịch sử conversation
  const loadConversationHistory = useCallback(async () => {
    try {
      const response = await startProductChat();
      const { conversation_id, messages: historyMessages } = response.data;
      
      setConversationId(conversation_id);
      localStorage.setItem("product_chatbot_conversation_id", conversation_id);
      
      // Nếu có lịch sử, load lại
      if (historyMessages && historyMessages.length > 0) {
        const formattedMessages = historyMessages.map((msg) => ({
          id: msg.id,
          type: msg.type,
          content: msg.content,
          timestamp: new Date(msg.timestamp),
          products: msg.products || null,
          showCategories: msg.showCategories || msg.showOccasions || false, // Hỗ trợ cả cũ và mới
          categoryId: msg.category_id || msg.categoryId || null,
          categoryName: msg.category_name || msg.categoryName || null,
        }));
        setMessages(formattedMessages);
      } else {
        // Nếu chưa có lịch sử, hiển thị tin nhắn chào hỏi
        const welcomeMessage = {
          id: "welcome-1",
          type: "bot",
          content: "Xin chào! 👋 Tôi là chatbot tư vấn sản phẩm. Bạn có thể:\n• Tìm sản phẩm theo danh mục\n• Tìm kiếm theo tên sản phẩm\n• Tư vấn theo ngân sách (ví dụ: dưới 500k, khoảng 300k)\n• Tư vấn theo dịp lễ\n• Xem sản phẩm phổ biến\n• Tư vấn theo giới tính/độ tuổi người nhận\n\nBạn muốn tìm gì hôm nay? 😊",
          timestamp: new Date(),
        };
        setMessages([welcomeMessage]);
        // Lưu welcome message vào backend
        await saveMessageToBackend(welcomeMessage);
        
        // Load anniversaries sau khi đã set welcome message
        setTimeout(() => loadUpcomingAnniversaries(), 300);
      }
    } catch (error) {
      console.error("Error loading conversation history:", error);
      // Nếu lỗi, vẫn hiển thị tin nhắn chào hỏi
      const welcomeMessage = {
        id: "welcome-1",
        type: "bot",
        content: "Xin chào! 👋 Tôi là chatbot tư vấn sản phẩm. Bạn có thể:\n• Tìm sản phẩm theo danh mục\n• Tìm kiếm theo tên sản phẩm\n• Tư vấn theo ngân sách (ví dụ: dưới 500k, khoảng 300k)\n• Tư vấn theo dịp lễ\n• Xem sản phẩm phổ biến\n• Tư vấn theo giới tính/độ tuổi người nhận\n\nBạn muốn tìm gì hôm nay? 😊",
        timestamp: new Date(),
      };
      setMessages([welcomeMessage]);
    }
  }, [saveMessageToBackend, loadUpcomingAnniversaries]);

  // Load reviews cho tất cả sản phẩm
  const loadReviews = async () => {
    try {
      const response = await axios.get('https://bebookgift-hugmbshcgaa0b4d6.eastasia-01.azurewebsites.net/api/reviews/');
      const allReviews = Array.isArray(response?.data) ? response.data : [];
      
      // Filter chỉ lấy reviews không bị block
      const validReviews = allReviews.filter(review => review && !review.is_blocked);
      
      // Tạo map product_id -> reviews
      const map = {};
      validReviews.forEach(review => {
        if (review.product_id) {
          if (!map[review.product_id]) {
            map[review.product_id] = [];
          }
          map[review.product_id].push(review);
        }
      });
      setReviewsMap(map);
    } catch (error) {
      console.error("Error loading reviews:", error);
    }
  };

  // Tính average rating cho sản phẩm
  const getProductRating = (productId) => {
    const productReviews = reviewsMap[productId] || [];
    if (productReviews.length === 0) return null;
    const sum = productReviews.reduce((acc, review) => acc + (review.rating || 0), 0);
    return (sum / productReviews.length).toFixed(1);
  };

  // Lấy số lượng reviews cho sản phẩm
  const getProductReviewCount = (productId) => {
    return reviewsMap[productId]?.length || 0;
  };

  // Khởi tạo conversation và load lịch sử
  useEffect(() => {
    loadCategories();
    loadOccasions();
    loadAllProducts();
    loadGiftOptions();
    loadReviews();
    
    // Nếu user đã đăng nhập, load lịch sử
    if (token && user) {
      loadConversationHistory();
    } else {
      // Nếu chưa đăng nhập, chỉ hiển thị tin nhắn chào hỏi
      const welcomeMessage = {
        id: "welcome-1",
        type: "bot",
        content: "Xin chào! 👋 Tôi là chatbot tư vấn sản phẩm. Bạn có thể:\n• Tìm sản phẩm theo danh mục\n• Tìm kiếm theo tên sản phẩm\n• Tư vấn theo ngân sách (ví dụ: dưới 500k, khoảng 300k)\n• Tư vấn theo dịp lễ\n• Xem sản phẩm phổ biến\n• Tư vấn theo giới tính/độ tuổi người nhận\n\nBạn muốn tìm gì hôm nay? 😊",
        timestamp: new Date(),
      };
      setMessages([welcomeMessage]);
    }
  }, [token, user, loadConversationHistory]);

  // Nhận diện giới tính từ text
  const detectGender = (text) => {
    const lowerText = text.toLowerCase();
    if (lowerText.includes('nam') || lowerText.includes('anh') || lowerText.includes('ông') || lowerText.includes('chú') || lowerText.includes('bố')) {
      return 'male';
    }
    if (lowerText.includes('nữ') || lowerText.includes('chị') || lowerText.includes('cô') || lowerText.includes('bà') || lowerText.includes('mẹ')) {
      return 'female';
    }
    return null;
  };

  // Nhận diện độ tuổi từ text
  const detectAge = (text) => {
    const lowerText = text.toLowerCase();
    // Tìm số tuổi
    const ageMatch = lowerText.match(/(\d+)\s*(?:tuổi|age|years?)/);
    if (ageMatch) {
      return parseInt(ageMatch[1]);
    }
    // Nhận diện theo từ khóa
    if (lowerText.includes('trẻ em') || lowerText.includes('bé') || lowerText.includes('con nhỏ') || lowerText.includes('thiếu nhi')) {
      return 'child';
    }
    if (lowerText.includes('thanh niên') || lowerText.includes('trẻ') || lowerText.includes('sinh viên')) {
      return 'young';
    }
    if (lowerText.includes('trung niên') || lowerText.includes('người lớn')) {
      return 'adult';
    }
    if (lowerText.includes('già') || lowerText.includes('cao tuổi') || lowerText.includes('ông bà')) {
      return 'senior';
    }
    return null;
  };

  // Auto scroll to bottom - luôn cuộn xuống dưới khi có tin nhắn mới hoặc loading
  useEffect(() => {
    const scrollToBottom = () => {
      if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
      }
    };
    
    // Delay nhỏ để đảm bảo DOM đã render
    const timeoutId = setTimeout(scrollToBottom, 100);
    return () => clearTimeout(timeoutId);
  }, [messages, loading]);

  // Load danh sách categories
  const loadCategories = async () => {
    try {
      const response = await getCategories();
      setCategories(response.data || []);
    } catch (error) {
      console.error("Error loading categories:", error);
    }
  };

  // Load danh sách occasions
  const loadOccasions = async () => {
    try {
      const response = await getOccasions();
      setOccasions(response.data || []);
    } catch (error) {
      console.error("Error loading occasions:", error);
    }
  };

  // Load tất cả sản phẩm (để tìm kiếm)
  const loadAllProducts = async () => {
    try {
      const response = await getProducts();
      setAllProducts(response.data || []);
    } catch (error) {
      console.error("Error loading all products:", error);
    }
  };

  // Load danh sách gift options
  const loadGiftOptions = async () => {
    try {
      const [papersRes, accessoriesRes, cardsRes] = await Promise.all([
        getWrappingPapers(),
        getDecorativeAccessories(),
        getCardTypes()
      ]);
      setGiftOptions({
        wrappingPapers: papersRes.data || [],
        decorativeAccessories: accessoriesRes.data || [],
        cardTypes: cardsRes.data || []
      });
    } catch (error) {
      console.error("Error loading gift options:", error);
    }
  };

  // Sử dụng service để nhận diện category
  const handleDetectCategory = (text) => {
    return detectCategory(text, categories);
  };

  // Load sản phẩm theo category
  const loadProductsByCategory = async (categoryId) => {
    setLoading(true);
    try {
      const response = await getProducts({ category_id: categoryId });
      return response.data || [];
    } catch (error) {
      console.error("Error loading products:", error);
      return [];
    } finally {
      setLoading(false);
    }
  };

  // Nhận diện occasion
  const detectOccasion = (text, occasions) => {
    if (!text || !occasions.length) return null;
    const lowerText = text.toLowerCase().trim();
    
    for (const occasion of occasions) {
      const occasionName = occasion.name.toLowerCase();
      if (lowerText.includes(occasionName) || occasionName.includes(lowerText)) {
        return occasion;
      }
    }
    return null;
  };

  // Load sản phẩm theo occasion
  const loadProductsByOccasion = async (occasionId) => {
    setLoading(true);
    try {
      const response = await getProducts({ occasion_id: occasionId });
      return response.data || [];
    } catch (error) {
      console.error("Error loading products by occasion:", error);
      return [];
    } finally {
      setLoading(false);
    }
  };

  // Load sản phẩm phổ biến (có thể filter theo số lượng đánh giá hoặc sales)
  const loadPopularProducts = async () => {
    setLoading(true);
    try {
      const response = await getProducts();
      const products = response.data || [];
      // Sort theo một tiêu chí nào đó (ví dụ: random top 8, hoặc có thể sort theo rating)
      return products.filter(p => p.is_active !== false).slice(0, 8);
    } catch (error) {
      console.error("Error loading popular products:", error);
      return [];
    } finally {
      setLoading(false);
    }
  };

  // Xử lý gửi tin nhắn
  const handleSendMessage = async () => {
    if (!inputText.trim()) return;

    const userMessage = {
      id: `user-${Date.now()}`,
      type: "user",
      content: inputText.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    const input = inputText.trim();
    setInputText("");
    setIsInputFocused(false);

    // Lưu tin nhắn user vào backend
    await saveMessageToBackend(userMessage);

    // Kiểm tra các keyword đặc biệt
    const lowerInput = input.toLowerCase();
    
    // 1. Kiểm tra "phổ biến" hoặc "bán chạy"
    if (lowerInput.includes('phổ biến') || lowerInput.includes('bán chạy') || lowerInput.includes('nổi bật') || lowerInput.includes('hot')) {
      const botConfirmMessage = {
        id: `bot-${Date.now()}`,
        type: "bot",
        content: "Để tôi tìm các sản phẩm phổ biến nhất cho bạn...",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, botConfirmMessage]);
      await saveMessageToBackend(botConfirmMessage);
      
      const popularProducts = await loadPopularProducts();
      const botProductsMessage = {
        id: `bot-products-${Date.now()}`,
        type: "bot",
        content: `Đây là ${popularProducts.length} sản phẩm phổ biến nhất hiện tại:`,
        timestamp: new Date(),
        products: popularProducts,
      };
      setMessages((prev) => [...prev, botProductsMessage]);
      await saveMessageToBackend(botProductsMessage);
      return;
    }

    // 2. Xử lý câu hỏi tương tác (nếu đang trong conversation state)
    if (conversationState) {
      if (conversationState === 'asking_recipient') {
        const detectedGender = detectGender(input);
        const detectedAge = detectAge(input);
        
        const newRecipientInfo = {
          gender: detectedGender || recipientInfo.gender,
          age: detectedAge || recipientInfo.age
        };
        setRecipientInfo(newRecipientInfo);
        
        if (detectedGender || detectedAge || recipientInfo.gender || recipientInfo.age) {
          const botConfirmMessage = {
            id: `bot-${Date.now()}`,
            type: "bot",
            content: `Cảm ơn bạn đã cung cấp thông tin! Để tôi tìm quà tặng phù hợp${newRecipientInfo.gender ? ` cho ${newRecipientInfo.gender === 'male' ? 'nam' : 'nữ'}` : ''}${newRecipientInfo.age ? ` ${typeof newRecipientInfo.age === 'number' ? `${newRecipientInfo.age} tuổi` : newRecipientInfo.age === 'child' ? 'trẻ em' : newRecipientInfo.age === 'young' ? 'thanh niên' : newRecipientInfo.age === 'adult' ? 'người lớn' : 'cao tuổi'}` : ''}...`,
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, botConfirmMessage]);
          await saveMessageToBackend(botConfirmMessage);
          
          // Filter sản phẩm - hiện tại hiển thị tất cả (có thể mở rộng filter logic)
          let filteredProducts = allProducts.filter(p => p.is_active !== false).slice(0, 10);
          
          const botProductsMessage = {
            id: `bot-products-${Date.now()}`,
            type: "bot",
            content: `Đây là các sản phẩm phù hợp:`,
            timestamp: new Date(),
            products: filteredProducts,
          };
          setMessages((prev) => [...prev, botProductsMessage]);
          await saveMessageToBackend(botProductsMessage);
          
          setConversationState(null);
          setRecipientInfo({ gender: null, age: null });
          return;
        } else {
          // Nếu không nhận diện được, hỏi lại
          const botAskAgainMessage = {
            id: `bot-${Date.now()}`,
            type: "bot",
            content: "Bạn có thể cho tôi biết rõ hơn về người nhận không? Ví dụ: nam/nữ, độ tuổi (ví dụ: 25 tuổi, trẻ em, thanh niên), hoặc sở thích?",
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, botAskAgainMessage]);
          await saveMessageToBackend(botAskAgainMessage);
          return;
        }
      }
    }
    
    // 3. Nhận diện yêu cầu tư vấn theo người nhận
    if (lowerInput.includes('tư vấn') || lowerInput.includes('gợi ý') || lowerInput.includes('tìm quà cho') || lowerInput.includes('tìm quà')) {
      const detectedGender = detectGender(input);
      const detectedAge = detectAge(input);
      
      if (detectedGender || detectedAge) {
        // Đã có thông tin trong input, xử lý ngay
        setRecipientInfo({
          gender: detectedGender,
          age: detectedAge
        });
        
        const botConfirmMessage = {
          id: `bot-${Date.now()}`,
          type: "bot",
          content: `Để tôi tìm quà tặng phù hợp${detectedGender ? ` cho ${detectedGender === 'male' ? 'nam' : 'nữ'}` : ''}${detectedAge ? ` ${typeof detectedAge === 'number' ? `${detectedAge} tuổi` : detectedAge === 'child' ? 'trẻ em' : detectedAge === 'young' ? 'thanh niên' : detectedAge === 'adult' ? 'người lớn' : 'cao tuổi'}` : ''}...`,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, botConfirmMessage]);
        await saveMessageToBackend(botConfirmMessage);
        
        let filteredProducts = allProducts.filter(p => p.is_active !== false).slice(0, 10);
        
        const botProductsMessage = {
          id: `bot-products-${Date.now()}`,
          type: "bot",
          content: `Đây là các sản phẩm phù hợp:`,
          timestamp: new Date(),
          products: filteredProducts,
        };
        setMessages((prev) => [...prev, botProductsMessage]);
        await saveMessageToBackend(botProductsMessage);
        return;
      } else {
        // Chưa có thông tin, hỏi lại
        setConversationState('asking_recipient');
        const botAskMessage = {
          id: `bot-${Date.now()}`,
          type: "bot",
          content: "Để tôi có thể tư vấn chính xác hơn, bạn có thể cho tôi biết:\n• Giới tính người nhận (Nam/Nữ)\n• Độ tuổi (ví dụ: 25 tuổi, trẻ em, thanh niên, người lớn, cao tuổi)\n• Dịp tặng quà (nếu có)\n\nVí dụ: \"Tìm quà cho nam 25 tuổi\" hoặc \"Gợi ý quà tặng nữ sinh nhật\"",
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, botAskMessage]);
        await saveMessageToBackend(botAskMessage);
        return;
      }
    }
    
    // 4. Nhận diện budget
    const detectedBudget = detectBudget(input);
    
    // 5. Nhận diện occasion
    const detectedOccasion = detectOccasion(input, occasions);
    
    // 6. Nhận diện category
    const detectedCategory = handleDetectCategory(input);
    
    // 7. Tìm kiếm theo tên sản phẩm (nếu không phải category/occasion)
    let searchedProducts = [];
    if (!detectedCategory && !detectedOccasion && allProducts.length > 0) {
      searchedProducts = searchProductsByName(input, allProducts);
    }

    // Xử lý theo thứ tự ưu tiên: Occasion > Category > Search > Budget filter
    
    // Xử lý Occasion
    if (detectedOccasion && detectedOccasion.id) {
      const botConfirmMessage = {
        id: `bot-${Date.now()}`,
        type: "bot",
        content: `Tuyệt vời! Tôi đã hiểu bạn đang tìm quà tặng cho dịp "${detectedOccasion.name}". Để tôi tìm các sản phẩm phù hợp cho bạn...`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, botConfirmMessage]);
      await saveMessageToBackend(botConfirmMessage);
      
      let productsData = await loadProductsByOccasion(detectedOccasion.id);
      
      // Áp dụng budget filter nếu có
      if (detectedBudget && productsData.length > 0) {
        productsData = filterProductsByBudget(productsData, detectedBudget);
      }
      
      const botProductsMessage = {
        id: `bot-products-${Date.now()}`,
        type: "bot",
        content: productsData.length > 0 
          ? `Tôi đã tìm thấy ${productsData.length} sản phẩm phù hợp cho dịp "${detectedOccasion.name}"${detectedBudget ? ' trong ngân sách bạn đề cập' : ''}:`
          : `Xin lỗi, không tìm thấy sản phẩm nào cho dịp "${detectedOccasion.name}"${detectedBudget ? ' trong ngân sách bạn đề cập' : ''}.`,
        timestamp: new Date(),
        products: productsData.slice(0, 10),
        occasionId: detectedOccasion.id,
        occasionName: detectedOccasion.name,
      };
      setMessages((prev) => [...prev, botProductsMessage]);
      await saveMessageToBackend(botProductsMessage);
      return;
    }
    
    // Xử lý Category
    if (detectedCategory && detectedCategory.id) {
      const botConfirmMessage = {
        id: `bot-${Date.now()}`,
        type: "bot",
        content: `Tuyệt vời! Tôi đã hiểu bạn đang tìm sản phẩm trong danh mục "${detectedCategory.name}". Để tôi tìm các sản phẩm phù hợp cho bạn...`,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, botConfirmMessage]);
      
      // Lưu tin nhắn bot confirm vào backend
      await saveMessageToBackend(botConfirmMessage);

      // Load sản phẩm
      let productsData = await loadProductsByCategory(detectedCategory.id);
      
      // Áp dụng budget filter nếu có
      if (detectedBudget && productsData.length > 0) {
        productsData = filterProductsByBudget(productsData, detectedBudget);
      }

      // Sử dụng service để tạo response
      const botResponse = createBotResponse(detectedCategory, productsData);

      // Thêm thông tin về dịch vụ gói quà vào message
      let contentWithGiftService = botResponse.content;
      if (detectedBudget) {
        const budgetText = detectedBudget.type === 'range' 
          ? `khoảng ${Math.round(detectedBudget.min/1000)}k - ${Math.round(detectedBudget.max/1000)}k`
          : detectedBudget.type === 'max'
          ? `dưới ${Math.round(detectedBudget.max/1000)}k`
          : `trên ${Math.round(detectedBudget.min/1000)}k`;
        contentWithGiftService = contentWithGiftService.replace(
          `trong danh mục "${detectedCategory.name}"`,
          `trong danh mục "${detectedCategory.name}" với ngân sách ${budgetText}`
        );
      }
      if (productsData.length > 0 && giftOptions.wrappingPapers.length > 0) {
        contentWithGiftService += "\n\n🎁 Tất cả sản phẩm đều có thể kèm dịch vụ gói quà chuyên nghiệp (giấy gói + phụ kiện + thiệp chúc mừng). Bạn có thể xem chi tiết bên dưới mỗi sản phẩm!";
      }

      const botProductsMessage = {
        id: `bot-products-${Date.now()}`,
        type: "bot",
        content: contentWithGiftService,
        timestamp: new Date(),
        products: botResponse.products || [],
        showCategories: botResponse.showCategories || false,
        categoryId: detectedCategory.id, // Lưu categoryId để navigate
        categoryName: detectedCategory.name,
      };

      setMessages((prev) => [...prev, botProductsMessage]);
      
      // Lưu tin nhắn bot products vào backend
      await saveMessageToBackend(botProductsMessage);

      if (botResponse.showCategories) {
        setShowQuickReplies(true);
      }
    } 
    // Xử lý tìm kiếm theo tên sản phẩm
    else if (searchedProducts.length > 0) {
      let filteredProducts = searchedProducts;
      
      // Áp dụng budget filter nếu có
      if (detectedBudget) {
        filteredProducts = filterProductsByBudget(searchedProducts, detectedBudget);
      }
      
      const botProductsMessage = {
        id: `bot-products-${Date.now()}`,
        type: "bot",
        content: filteredProducts.length > 0
          ? `Tôi đã tìm thấy ${filteredProducts.length} sản phẩm phù hợp với "${input}"${detectedBudget ? ' trong ngân sách bạn đề cập' : ''}:`
          : `Xin lỗi, không tìm thấy sản phẩm nào phù hợp với "${input}"${detectedBudget ? ' trong ngân sách bạn đề cập' : ''}.`,
        timestamp: new Date(),
        products: filteredProducts.slice(0, 10),
      };
      setMessages((prev) => [...prev, botProductsMessage]);
      await saveMessageToBackend(botProductsMessage);
    }
    // Chỉ có budget mà không có category/product
    else if (detectedBudget && allProducts.length > 0) {
      const filteredProducts = filterProductsByBudget(allProducts, detectedBudget);
      const budgetText = detectedBudget.type === 'range' 
        ? `khoảng ${Math.round(detectedBudget.min/1000)}k - ${Math.round(detectedBudget.max/1000)}k`
        : detectedBudget.type === 'max'
        ? `dưới ${Math.round(detectedBudget.max/1000)}k`
        : `trên ${Math.round(detectedBudget.min/1000)}k`;
      
      const botProductsMessage = {
        id: `bot-products-${Date.now()}`,
        type: "bot",
        content: filteredProducts.length > 0
          ? `Tôi đã tìm thấy ${filteredProducts.length} sản phẩm với ngân sách ${budgetText}:`
          : `Xin lỗi, không tìm thấy sản phẩm nào trong ngân sách ${budgetText}.`,
        timestamp: new Date(),
        products: filteredProducts.slice(0, 10),
      };
      setMessages((prev) => [...prev, botProductsMessage]);
      await saveMessageToBackend(botProductsMessage);
    }
    else {
      // Không nhận diện được gì cả
      const botNotFoundMessage = {
        id: `bot-notfound-${Date.now()}`,
        type: "bot",
        content:
          "Xin lỗi, tôi chưa hiểu rõ bạn muốn tìm gì. Bạn có thể:\n• Tìm sản phẩm theo danh mục\n• Tìm kiếm theo tên sản phẩm\n• Tư vấn theo ngân sách (ví dụ: dưới 500k, khoảng 300k)\n• Tư vấn theo dịp lễ\n• Xem sản phẩm phổ biến (gõ: phổ biến, bán chạy, hot)\n\nHoặc chọn một trong các danh mục sau:",
        timestamp: new Date(),
        showCategories: true,
      };
      setMessages((prev) => [...prev, botNotFoundMessage]);
      
      // Lưu tin nhắn bot not found vào backend
      await saveMessageToBackend(botNotFoundMessage);
      
      setShowQuickReplies(true);
    }
  };

  // Xử lý chọn category từ quick reply
  const handleQuickReplyClick = (category) => {
    // 清除延迟隐藏
    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current);
    }
    setInputText(category.name);
    setIsInputFocused(false);
    setShowQuickReplies(false);
    // 让输入框重新获得焦点以便发送消息
    setTimeout(() => {
      inputRef.current?.focus();
      handleSendMessage();
    }, 100);
  };

  // Format giá tiền
  const formatPrice = (price) => {
    return new Intl.NumberFormat("vi-VN").format(price) + " đ";
  };

  // Format thời gian
  const formatTime = (date) => {
    const d = new Date(date);
    return d.toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Thêm vào giỏ hàng kèm dịch vụ gói quà
  const handleAddToCartWithGift = async (productId, giftOptions = {}) => {
    const tokenFromContext = token;
    let tokenFromStorage = localStorage.getItem('token');
    
    if (tokenFromStorage === 'undefined' || tokenFromStorage === 'null') {
      localStorage.removeItem('token');
      tokenFromStorage = null;
    }
    
    const currentToken = tokenFromContext || tokenFromStorage;
    
    if (!currentToken || currentToken === 'undefined' || currentToken === 'null') {
      navigate('/login');
      return;
    }

    try {
      setAddingToCart(prev => ({ ...prev, [productId]: true }));
      
      // Thêm sản phẩm vào giỏ hàng
      await axios.post(
        "https://bebookgift-hugmbshcgaa0b4d6.eastasia-01.azurewebsites.net/api/cart/add",
        { product_id: productId, quantity: 1 },
        { headers: { Authorization: `Bearer ${currentToken}` } }
      );

      // Lưu gift options vào localStorage để checkout có thể load
      if (giftOptions.wrappingPaper || giftOptions.accessory || giftOptions.card) {
        const giftOptionsData = {
          wrappingPaperId: giftOptions.wrappingPaper?.id || null,
          wrappingPaper: giftOptions.wrappingPaper?.name || null,
          decorativeAccessoryId: giftOptions.accessory?.id || null,
          decorativeAccessories: giftOptions.accessory?.name || null,
          cardTypeId: giftOptions.card?.id || null,
          cardType: giftOptions.card?.name || null,
          timestamp: Date.now() // Để có thể xóa sau một thời gian
        };
        localStorage.setItem('pendingGiftOptions', JSON.stringify(giftOptionsData));
      }

      // Đóng chatbot và navigate đến cart
      if (onClose) onClose();
      navigate('/cart');
    } catch (err) {
      console.error("Add to cart error:", err);
      const errorMsg = (err.response && err.response.data && err.response.data.message) || err.message || "Lỗi khi thêm vào giỏ hàng";
      alert("❌ " + errorMsg);
    } finally {
      setAddingToCart(prev => ({ ...prev, [productId]: false }));
    }
  };

  // Lấy gợi ý dịch vụ gói quà phù hợp (theo dịp lễ hoặc sản phẩm)
  // Sử dụng index để mỗi sản phẩm có dịch vụ gói quà khác nhau, tránh trùng lặp
  const getRecommendedGiftOptions = (productId, productIndex = 0) => {
    if (!giftOptions.wrappingPapers.length || !giftOptions.decorativeAccessories.length || !giftOptions.cardTypes.length) {
      return {
        wrappingPapers: [],
        decorativeAccessories: [],
        cardTypes: []
      };
    }

    // Sử dụng productIndex để lấy các mẫu khác nhau cho mỗi sản phẩm
    // Vòng lặp lại nếu hết mẫu
    const paperIndex = productIndex % giftOptions.wrappingPapers.length;
    const accessoryIndex = productIndex % giftOptions.decorativeAccessories.length;
    const cardIndex = productIndex % giftOptions.cardTypes.length;
    
    return {
      wrappingPapers: [giftOptions.wrappingPapers[paperIndex]],
      decorativeAccessories: [giftOptions.decorativeAccessories[accessoryIndex]],
      cardTypes: [giftOptions.cardTypes[cardIndex]]
    };
  };

  // Xóa lịch sử chat
  const handleClearChatHistory = async () => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa toàn bộ lịch sử chat không?")) {
      return;
    }

    try {
      if (token && user && conversationId) {
        // Xóa trên backend
        await clearProductChatHistory();
      }

      // Reset state
      setMessages([]);
      setConversationId(null);
      localStorage.removeItem("product_chatbot_conversation_id");

      // Hiển thị tin nhắn chào hỏi mới
      const welcomeMessage = {
        id: "welcome-1",
        type: "bot",
        content: "Xin chào! 👋 Tôi là chatbot tư vấn sản phẩm. Bạn có thể:\n• Tìm sản phẩm theo danh mục\n• Tìm kiếm theo tên sản phẩm\n• Tư vấn theo ngân sách (ví dụ: dưới 500k, khoảng 300k)\n• Tư vấn theo dịp lễ\n• Xem sản phẩm phổ biến\n\nBạn muốn tìm gì hôm nay? 😊",
        timestamp: new Date(),
      };
      setMessages([welcomeMessage]);

      // Tạo conversation mới nếu user đã đăng nhập
      if (token && user) {
        const response = await startProductChat();
        const { conversation_id } = response.data;
        setConversationId(conversation_id);
        localStorage.setItem("product_chatbot_conversation_id", conversation_id);
        
        // Lưu welcome message vào backend
        await saveMessageToBackend(welcomeMessage);
      }
    } catch (error) {
      console.error("Error clearing chat history:", error);
      alert("❌ Có lỗi xảy ra khi xóa lịch sử chat. Vui lòng thử lại.");
    }
  };

  return (
    <div className="product-chatbot-container">
      <div className="product-chatbot-header">
        <div className="chatbot-header-info">
          <div className="chatbot-avatar">🤖</div>
          <div>
            <h3>Tư vấn Sản phẩm</h3>
            <p className="chatbot-status">Sẵn sàng hỗ trợ bạn</p>
          </div>
        </div>
        <div className="chatbot-header-actions">
          {messages.length > 1 && (
            <button 
              className="chatbot-clear-btn" 
              onClick={handleClearChatHistory}
              title="Xóa lịch sử chat"
            >
              🗑️
            </button>
          )}
        {onClose && (
          <button className="chatbot-close-btn" onClick={onClose}>
            ✕
          </button>
        )}
        </div>
      </div>

      <div className="product-chatbot-messages">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`chatbot-message ${message.type === "user" ? "user" : "bot"}`}
          >
            <div className="message-content">
              {message.content}
              
              {/* Hiển thị sản phẩm nếu có */}
              {message.products && message.products.length > 0 && (
                <div className="products-list">
                  {message.products.slice(0, 5).map((product, productIndex) => {
                    // Sử dụng productIndex để mỗi sản phẩm có dịch vụ gói quà khác nhau
                    const recommendedGifts = getRecommendedGiftOptions(product.id, productIndex);
                    const totalGiftPrice = 
                      (recommendedGifts.wrappingPapers[0]?.price || 0) +
                      (recommendedGifts.decorativeAccessories[0]?.price || 0) +
                      (recommendedGifts.cardTypes[0]?.price || 0);
                    
                    return (
                      <div key={product.id} className="product-card-wrapper">
                        <div 
                          className="product-card"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onClose) onClose();
                            navigate(`/products/${product.id}`);
                          }}
                        >
                      <div className="product-image">
                        {product.image_url ? (
                          <img src={product.image_url} alt={product.name} />
                        ) : (
                          <div className="product-placeholder">📦</div>
                        )}
                      </div>
                      <div className="product-info">
                        <h4>{product.name}</h4>
                        {product.short_description && (
                          <p className="product-short-description">
                            {product.short_description}
                          </p>
                        )}
                            {/* Rating */}
                            {(() => {
                              const rating = getProductRating(product.id);
                              const reviewCount = getProductReviewCount(product.id);
                              if (rating) {
                                return (
                                  <div className="product-rating-chatbot" style={{ 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    gap: '6px',
                                    marginBottom: '4px',
                                    fontSize: '11px'
                                  }}>
                                    <StarRating rating={parseFloat(rating)} readonly={true} size="11px" />
                                    <span style={{ color: '#666', fontWeight: 500 }}>{rating}</span>
                                    <span style={{ color: '#999' }}>({reviewCount} đánh giá)</span>
                                  </div>
                                );
                              }
                              return null;
                            })()}
                        <p className="product-price">
                          {formatPrice(product.price)}
                        </p>
                        {product.stock_quantity > 0 ? (
                          <span className="product-stock in-stock">
                            Còn hàng
                          </span>
                        ) : (
                          <span className="product-stock out-of-stock">
                            Hết hàng
                          </span>
                        )}
                      </div>
                    </div>

                        {/* Dịch vụ gói quà */}
                        {product.stock_quantity > 0 && giftOptions.wrappingPapers.length > 0 && (
                          <div className="gift-service-section">
                            <div className="gift-service-header">
                              <span className="gift-service-icon">🎁</span>
                              <span className="gift-service-title">Dịch vụ gói quà</span>
                              {totalGiftPrice > 0 && (
                                <span className="gift-service-price">
                                  +{formatPrice(totalGiftPrice)}
                                </span>
                              )}
                            </div>
                            <div className="gift-service-options">
                              {recommendedGifts.wrappingPapers[0] && (
                                <div className="gift-option-item">
                                  <span className="gift-option-label">Giấy gói:</span>
                                  <span className="gift-option-name">
                                    {recommendedGifts.wrappingPapers[0].name}
                                    {recommendedGifts.wrappingPapers[0].price > 0 && (
                                      <span className="gift-option-price-small">
                                        {' '}(+{formatPrice(recommendedGifts.wrappingPapers[0].price)})
                                      </span>
                                    )}
                                  </span>
                                </div>
                              )}
                              {recommendedGifts.decorativeAccessories[0] && (
                                <div className="gift-option-item">
                                  <span className="gift-option-label">Phụ kiện:</span>
                                  <span className="gift-option-name">
                                    {recommendedGifts.decorativeAccessories[0].name}
                                    {recommendedGifts.decorativeAccessories[0].price > 0 && (
                                      <span className="gift-option-price-small">
                                        {' '}(+{formatPrice(recommendedGifts.decorativeAccessories[0].price)})
                                      </span>
                                    )}
                                  </span>
                                </div>
                              )}
                              {recommendedGifts.cardTypes[0] && (
                                <div className="gift-option-item">
                                  <span className="gift-option-label">Thiệp:</span>
                                  <span className="gift-option-name">
                                    {recommendedGifts.cardTypes[0].name}
                                    {recommendedGifts.cardTypes[0].price > 0 && (
                                      <span className="gift-option-price-small">
                                        {' '}(+{formatPrice(recommendedGifts.cardTypes[0].price)})
                                      </span>
                                    )}
                                  </span>
                                </div>
                              )}
                            </div>
                            <button
                              className="add-to-cart-with-gift-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAddToCartWithGift(product.id, {
                                  wrappingPaper: recommendedGifts.wrappingPapers[0],
                                  accessory: recommendedGifts.decorativeAccessories[0],
                                  card: recommendedGifts.cardTypes[0]
                                });
                              }}
                              disabled={addingToCart[product.id]}
                            >
                              {addingToCart[product.id] ? 'Đang thêm...' : '🛒 Thêm vào giỏ hàng + Dịch vụ gói quà'}
                            </button>
                            <div className="gift-service-note">
                              💡 Bạn có thể chọn dịch vụ gói quà khác khi thanh toán
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {message.products.length > 5 && (
                    <p className="more-products-text">
                      ... và {message.products.length - 5} sản phẩm khác
                    </p>
                  )}
                  {/* Nút xem tất cả sản phẩm trong danh mục */}
                  {message.categoryId && (
                    <button
                      className="view-all-products-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onClose) onClose();
                        navigate(`/products?category_id=${message.categoryId}`);
                      }}
                    >
                      Xem tất cả sản phẩm trong danh mục "{message.categoryName || 'này'}"
                    </button>
                  )}
                </div>
              )}

              {/* Hiển thị anniversary reminder với nút gợi ý quà */}
              {message.showAnniversaryReminder && message.anniversary && (
                <div className="anniversary-reminder-section" style={{
                  marginTop: '12px',
                  padding: '12px',
                  background: 'linear-gradient(135deg, rgba(93, 42, 66, 0.1) 0%, rgba(251, 99, 118, 0.1) 100%)',
                  border: '1.5px solid rgba(251, 99, 118, 0.3)',
                  borderRadius: '10px'
                }}>
                  <div style={{ marginBottom: '8px', fontSize: '13px', fontWeight: 600, color: '#5D2A42' }}>
                    📅 {message.anniversary.event_name}
                  </div>
                  <button
                    className="suggest-gift-btn"
                    onClick={async (e) => {
                      e.stopPropagation();
                      // Tìm sản phẩm phù hợp cho dịp lễ này
                      const occasionName = message.anniversary.event_name.toLowerCase();
                      const matchedOccasion = occasions.find(occ => 
                        occasionName.includes(occ.name.toLowerCase()) || 
                        occ.name.toLowerCase().includes(occasionName)
                      );
                      
                      if (matchedOccasion) {
                        const productsData = await loadProductsByOccasion(matchedOccasion.id);
                        const botProductsMessage = {
                          id: `bot-products-${Date.now()}`,
                          type: "bot",
                          content: `Đây là các sản phẩm phù hợp cho dịp "${message.anniversary.event_name}":`,
                          timestamp: new Date(),
                          products: productsData.slice(0, 8),
                          occasionId: matchedOccasion.id,
                          occasionName: matchedOccasion.name,
                        };
                        setMessages((prev) => [...prev, botProductsMessage]);
                        await saveMessageToBackend(botProductsMessage);
                      } else {
                        // Nếu không tìm thấy occasion, hiển thị sản phẩm phổ biến
                        const popularProducts = await loadPopularProducts();
                        const botProductsMessage = {
                          id: `bot-products-${Date.now()}`,
                          type: "bot",
                          content: `Đây là các sản phẩm phổ biến phù hợp cho dịp "${message.anniversary.event_name}":`,
                          timestamp: new Date(),
                          products: popularProducts,
                        };
                        setMessages((prev) => [...prev, botProductsMessage]);
                        await saveMessageToBackend(botProductsMessage);
                      }
                    }}
                    style={{
                      width: '100%',
                      padding: '8px 16px',
                      background: 'linear-gradient(135deg, #FB6376 0%, #FCB1A6 100%)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.3s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(251, 99, 118, 0.4)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    🎁 Gợi ý quà tặng cho dịp này
                  </button>
                </div>
              )}

              {/* Hiển thị danh sách categories nếu không nhận diện được */}
              {message.showCategories && categories.length > 0 && (
                <div className="occasions-list">
                  {categories.slice(0, 6).map((category) => (
                    <button
                      key={category.id}
                      className="occasion-chip"
                      onClick={() => handleQuickReplyClick(category)}
                    >
                      {category.name}
                    </button>
                  ))}
                </div>
              )}

              <span className="message-time">
                {formatTime(message.timestamp)}
              </span>
            </div>
          </div>
        ))}

        {loading && (
          <div className="chatbot-message bot">
            <div className="message-content">
              <div className="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Replies - 当输入框获得焦点时显示 */}
      {isInputFocused && categories.length > 0 && (
        <div className="quick-replies">
          <div className="quick-replies-header">
            <p className="quick-replies-label">Chọn danh mục:</p>
            <button 
              className="quick-replies-toggle-btn"
              onClick={() => {
                setIsInputFocused(false);
                setShowQuickReplies(false);
              }}
              title="Ẩn danh mục"
            >
              ✕
            </button>
          </div>
          <div className="quick-replies-list">
            {categories.slice(0, 6).map((category) => (
              <button
                key={category.id}
                className="quick-reply-btn"
                onClick={() => handleQuickReplyClick(category)}
              >
                {category.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="product-chatbot-input">
        <input
          ref={inputRef}
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onFocus={() => {
            // 清除之前的延迟隐藏
            if (blurTimeoutRef.current) {
              clearTimeout(blurTimeoutRef.current);
            }
            setIsInputFocused(true);
            setShowQuickReplies(true);
          }}
          onBlur={(e) => {
            // 延迟隐藏，以便点击类别按钮时不会立即隐藏
            blurTimeoutRef.current = setTimeout(() => {
              if (!e.target.value.trim()) {
                setIsInputFocused(false);
                setShowQuickReplies(false);
              }
            }, 200);
          }}
          onKeyPress={(e) => {
            if (e.key === "Enter") {
              handleSendMessage();
            }
          }}
          placeholder="💬 Hỏi tôi bất cứ điều gì về sản phẩm..."
          disabled={loading}
        />
        <button
          onClick={handleSendMessage}
          disabled={!inputText.trim() || loading}
          className="send-btn"
        >
          ➤
        </button>
      </div>
    </div>
  );
}

