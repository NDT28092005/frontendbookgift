import axios from "axios";

const API_URL = "https://bebookgift-hugmbshcgaa0b4d6.eastasia-01.azurewebsites.net/api/gift-options";

// Lấy danh sách giấy gói
export const getWrappingPapers = () => axios.get(`${API_URL}/wrapping-papers`);

// Lấy danh sách phụ kiện trang trí
export const getDecorativeAccessories = () => axios.get(`${API_URL}/decorative-accessories`);

// Lấy danh sách loại thiệp
export const getCardTypes = () => axios.get(`${API_URL}/card-types`);

// Generate gift preview
export const generateGiftPreview = (data) => {
  const token = localStorage.getItem("token");
  return axios.post(
    `${API_URL.replace('/gift-options', '/gift-preview')}/preview`,
    data,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    }
  );
};
