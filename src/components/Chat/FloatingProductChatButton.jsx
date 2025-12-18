import React, { useState } from "react";
import { useLocation } from "react-router-dom";
import ProductChatBot from "./ProductChatBot";
import "./FloatingProductChatButton.css";

export default function FloatingProductChatButton() {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();

  // 不显示在admin页面
  const isAdminPage = location.pathname.startsWith("/admin");

  if (isAdminPage) {
    return null;
  }

  const handleOpenChat = () => {
    setIsOpen(true);
  };

  const handleCloseChat = () => {
    setIsOpen(false);
  };

  return (
    <>
      {isOpen && (
        <div className="product-chatbot-overlay" onClick={handleCloseChat}>
          <div className="product-chatbot-wrapper slide-up" onClick={(e) => e.stopPropagation()}>
            <ProductChatBot onClose={handleCloseChat} />
          </div>
        </div>
      )}

      {!isOpen && (
        <div
          className="floating-product-chatbot-btn"
          onClick={handleOpenChat}
          title="Chatbot Tư vấn Sản phẩm"
        >
          💬
        </div>
      )}
    </>
  );
}

